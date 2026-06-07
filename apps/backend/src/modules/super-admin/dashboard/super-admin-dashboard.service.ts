import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  bakuMonthKey,
  bakuStartOfDayUtc,
  bakuStartOfMonthUtcMonthsAgo,
} from '../../tenant-dashboard/baku-day';

/**
 * Super-admin platform dashboard rollup — one endpoint returns everything
 * the C2.1 platform dashboard needs in a single round-trip.
 *
 * Mirrors the tenant-dashboard service-as-rollup pattern: fan out N small
 * index-backed queries via `Promise.all`, BigInt-tetri math for AZN sums,
 * Baku-calendar boundaries for day/month math. Super-admin actors bypass
 * the Prisma scoping extension by default (see backend pattern §1), so
 * `prisma.scoped.*` here returns ALL tenants/transactions/etc. — no
 * `withBypass` wrappers needed inside the controller's auth context.
 *
 * Performance at MVP scale (<100 tenants, <10k tx/day each): seven small
 * queries in parallel total ~10-30ms p95. If platform growth pushes this
 * past ~50ms we'd materialize a daily snapshot table or precompute MRR.
 */
@Injectable()
export class SuperAdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();

    const [tenants, totalDevices, txToday, txMonth, mrr, tenantGrowth6mo, watchlist, activity] =
      await Promise.all([
        this.getTenantsByStatus(),
        this.getTotalDevices(),
        this.getTxKpis(bakuStartOfDayUtc(now), '24h'),
        this.getTxKpis(bakuStartOfMonthUtcMonthsAgo(now, 0), 'month'),
        this.getMrr(now),
        this.getTenantGrowth6mo(now),
        this.getSubscriptionWatchlist(now),
        this.getRecentActivity(),
      ]);

    return {
      tenants,
      totalDevices,
      txToday,
      txMonth,
      mrr,
      tenantGrowth6mo,
      subscriptionWatchlist: watchlist,
      recentActivity: activity,
    };
  }

  /** Tenant counts by status. Excludes soft-deleted rows. */
  private async getTenantsByStatus() {
    const grouped = await this.prisma.scoped.tenant.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { _all: true },
    });

    const out = { total: 0, active: 0, suspended: 0, pending: 0, hidden: 0 };
    for (const row of grouped) {
      out.total += row._count._all;
      out[row.status] = row._count._all;
    }
    return out;
  }

  /**
   * Live, customer-facing device count: active bays under active+visible
   * locations under active+non-deleted tenants. This is the number the
   * platform operator cares about (how many QR boxes can a customer
   * actually scan today?).
   */
  private async getTotalDevices(): Promise<number> {
    return this.prisma.scoped.bay.count({
      where: {
        status: 'active',
        location: { status: 'active', deletedAt: null },
        tenant: { status: 'active', deletedAt: null },
      },
    });
  }

  /**
   * Paid transactions in a window. `paid_credited` + `paid_hardware_error`
   * both count (bank charged the customer in both cases — the difference
   * is whether the hardware ACK arrived).
   *
   * `mode === 'month'` runs from start-of-baku-month to "now".
   * `mode === '24h'` runs from start-of-baku-day to start + 24h.
   */
  private async getTxKpis(start: Date, mode: '24h' | 'month') {
    const end = mode === '24h' ? new Date(start.getTime() + 24 * 60 * 60 * 1000) : new Date();

    const rows = await this.prisma.scoped.transaction.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        status: { in: ['paid_credited', 'paid_hardware_error'] },
      },
      select: { amountAzn: true },
    });

    let paidTetri = 0n;
    for (const row of rows) paidTetri += decimalToTetri(row.amountAzn);
    return {
      paidAmountAzn: tetriToAznString(paidTetri),
      txCount: rows.length,
    };
  }

  /**
   * MRR = sum of Subscription payments recorded in the last 30 calendar
   * days. This is the "recurring" lens super-admin uses to track cashflow.
   * Subscriptions are recorded manually by super-admin (Phase 4.7); MRR
   * is purely derived.
   */
  private async getMrr(now: Date) {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.scoped.subscription.findMany({
      where: { paidAt: { gte: thirtyDaysAgo } },
      select: { amountAzn: true },
    });

    let totalTetri = 0n;
    for (const row of rows) totalTetri += decimalToTetri(row.amountAzn);
    return {
      amountAzn: tetriToAznString(totalTetri),
      subscriptionCount: rows.length,
    };
  }

  /**
   * Last 6 Baku calendar months (including current). Each bucket = count
   * of tenants whose `createdAt` falls in that Baku calendar month.
   * Includes later-deleted tenants because they DID grow the platform in
   * that month — the chart is historical growth, not current headcount.
   */
  private async getTenantGrowth6mo(now: Date) {
    const earliest = bakuStartOfMonthUtcMonthsAgo(now, 5); // 5 months back + current = 6 buckets

    const buckets: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const key = bakuMonthKey(bakuStartOfMonthUtcMonthsAgo(now, i));
      buckets[key] = 0;
    }

    const tenants = await this.prisma.scoped.tenant.findMany({
      where: { createdAt: { gte: earliest } },
      select: { createdAt: true },
    });

    for (const t of tenants) {
      const key = bakuMonthKey(t.createdAt);
      if (key in buckets) buckets[key] += 1;
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
  }

  /**
   * Tenants whose subscription expires within the next 14 days (or has
   * already expired) and are not hidden/deleted. The super-admin uses
   * this to decide who to reach out to for renewal. Status `pending` is
   * excluded — pending tenants haven't paid their first subscription
   * yet, so a subscription expiry there is a different workflow.
   */
  private async getSubscriptionWatchlist(now: Date) {
    const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.scoped.tenant.findMany({
      where: {
        deletedAt: null,
        status: { in: ['active', 'suspended'] },
        subscriptionEnd: { not: null, lte: horizon },
      },
      orderBy: { subscriptionEnd: 'asc' },
      take: 50,
      select: {
        id: true,
        brandName: true,
        status: true,
        subscriptionEnd: true,
      },
    });

    return rows
      .filter((r): r is typeof r & { subscriptionEnd: Date } => r.subscriptionEnd !== null)
      .map((r) => ({
        tenantId: r.id,
        brandName: r.brandName,
        status: r.status,
        subscriptionEnd: r.subscriptionEnd.toISOString(),
        daysLeft: diffBakuDays(now, r.subscriptionEnd),
      }));
  }

  /** Latest 10 audit-log rows across the entire platform. */
  private async getRecentActivity() {
    const rows = await this.prisma.scoped.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        actorType: true,
        actorId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        createdAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      actorType: r.actorType,
      actorId: r.actorId,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

// ─── Tetri helpers ─────────────────────────────────────────────────
// Duplicated from tenant-dashboard.service.ts on purpose — these are
// small, the future direction is to extract them to a backend `common/`
// helper once a third user appears. For now, parallel copies keep the
// two services independently reviewable.

function decimalToTetri(d: Prisma.Decimal): bigint {
  const [int, frac = '00'] = d.toFixed(2).split('.');
  return BigInt(int) * 100n + BigInt(frac.padEnd(2, '0').slice(0, 2));
}

function tetriToAznString(t: bigint): string {
  const neg = t < 0n;
  const abs = neg ? -t : t;
  const major = abs / 100n;
  const minor = abs % 100n;
  return `${neg ? '-' : ''}${major.toString()}.${minor.toString().padStart(2, '0')}`;
}

/**
 * Whole-day Baku-calendar difference (to - from). Mirrors tenant-
 * notifications.service's diffBakuDays exactly so the day-left numbers
 * we surface here use the same convention as the tenant-side ones.
 */
function diffBakuDays(from: Date, to: Date): number {
  const fromKey = new Date(from.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const toKey = new Date(to.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const a = Date.UTC(
    Number(fromKey.slice(0, 4)),
    Number(fromKey.slice(5, 7)) - 1,
    Number(fromKey.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(toKey.slice(0, 4)),
    Number(toKey.slice(5, 7)) - 1,
    Number(toKey.slice(8, 10)),
  );
  return Math.round((b - a) / 86_400_000);
}
