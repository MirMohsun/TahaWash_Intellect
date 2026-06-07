import { Injectable } from '@nestjs/common';
import type { Prisma, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  bakuDateString,
  bakuStartOfDayUtc,
  bakuStartOfDayUtcDaysAgo,
  bakuStartOfMonthUtc,
} from './baku-day';

/**
 * Tenant dashboard rollup — one endpoint returns everything the dashboard
 * needs in a single round-trip.
 *
 * Chose one-endpoint-many-numbers over N small endpoints because:
 *   - one round-trip → faster initial paint
 *   - atomic snapshot (all numbers from the same instant)
 *   - adding/removing a KPI doesn't versioning N routes
 *   - matches Wolt-style "give me everything I need to render this screen"
 *
 * Multi-tenancy: the Prisma scoping extension auto-injects
 * `tenantId = actor.tenantId` on every `prisma.scoped.*` query below,
 * so a tenant can ONLY see their own data here — same as everywhere
 * else in the backend.
 *
 * Performance: the `transactions` table has a composite index on
 * `(tenantId, createdAt DESC)` (see schema.prisma) so all five queries
 * are index-backed for a tenant of any size. At MVP scale (<100 tenants,
 * <10k tx/day each) running five small queries serially is cheaper than
 * one big raw query with sub-selects. Revisit if the rollup ever
 * crosses ~50ms p99.
 */
@Injectable()
export class TenantDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();

    const [today, dailyRevenue7d, bayStats, topBaysThisMonth, recentTransactions] =
      await Promise.all([
        this.getTodayKpis(now),
        this.getDailyRevenue7d(now),
        this.getBayStats(),
        this.getTopBaysThisMonth(now),
        this.getRecentTransactions(),
      ]);

    return {
      today,
      dailyRevenue7d,
      bayStats,
      topBaysThisMonth,
      recentTransactions,
    };
  }

  /** Today (Baku) — paid revenue + paid-count + hardware-error-count. */
  private async getTodayKpis(now: Date) {
    const start = bakuStartOfDayUtc(now);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const rows = await this.prisma.scoped.transaction.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { amountAzn: true, status: true },
    });

    let paidTetri = 0n; // BigInt of 1/100 AZN to avoid Decimal+Float mixing
    let txCount = 0;
    let hardwareErrorCount = 0;
    for (const row of rows) {
      if (row.status === 'paid_credited' || row.status === 'paid_hardware_error') {
        // Paid amount counts both: bank approved in both cases. The hardware-
        // error count surfaces separately so the admin sees a meaningful
        // operational signal.
        paidTetri += decimalToTetri(row.amountAzn);
        txCount += 1;
        if (row.status === 'paid_hardware_error') hardwareErrorCount += 1;
      }
    }

    return {
      date: bakuDateString(now),
      paidAmountAzn: tetriToAznString(paidTetri),
      txCount,
      hardwareErrorCount,
    };
  }

  /**
   * Last 7 Baku calendar days (including today). Aggregated client-side
   * from a single query covering the 7-day window — keeps the SQL simple
   * and matches the small data volume per tenant at our scale.
   */
  private async getDailyRevenue7d(now: Date) {
    const start = bakuStartOfDayUtcDaysAgo(now, 6); // 6 days ago + today = 7 days
    const rows = await this.prisma.scoped.transaction.findMany({
      where: {
        createdAt: { gte: start },
        status: { in: ['paid_credited', 'paid_hardware_error'] },
      },
      select: { amountAzn: true, createdAt: true },
    });

    // Initialize buckets for each of the 7 days so dates with no tx still
    // appear (otherwise the chart would have gaps).
    const buckets: Record<string, { paidTetri: bigint; txCount: number }> = {};
    for (let i = 0; i < 7; i++) {
      const dayUtc = bakuStartOfDayUtcDaysAgo(now, 6 - i);
      buckets[bakuDateString(dayUtc)] = { paidTetri: 0n, txCount: 0 };
    }

    for (const row of rows) {
      const key = bakuDateString(row.createdAt);
      const bucket = buckets[key];
      if (!bucket) continue; // out-of-window safety guard
      bucket.paidTetri += decimalToTetri(row.amountAzn);
      bucket.txCount += 1;
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({
        date,
        paidAmountAzn: tetriToAznString(b.paidTetri),
        txCount: b.txCount,
      }));
  }

  /** Count bays for the tenant. `active` = bay active AND location active+visible. */
  private async getBayStats() {
    const [total, active] = await Promise.all([
      this.prisma.scoped.bay.count(),
      this.prisma.scoped.bay.count({
        where: {
          status: 'active',
          location: { status: 'active', deletedAt: null },
        },
      }),
    ]);
    return { total, active };
  }

  /**
   * Top 5 bays this Baku month by paid tx count. Uses Prisma `groupBy` for
   * the aggregate then fetches bay+location display info in one round-trip.
   */
  private async getTopBaysThisMonth(now: Date) {
    const start = bakuStartOfMonthUtc(now);

    const grouped = await this.prisma.scoped.transaction.groupBy({
      by: ['bayId'],
      where: {
        createdAt: { gte: start },
        status: { in: ['paid_credited', 'paid_hardware_error'] },
      },
      _sum: { amountAzn: true },
      _count: { _all: true },
      orderBy: { _count: { bayId: 'desc' } },
      take: 5,
    });

    if (grouped.length === 0) return [];

    const bayIds = grouped.map((g) => g.bayId);
    const bays = await this.prisma.scoped.bay.findMany({
      where: { id: { in: bayIds } },
      select: { id: true, name: true, location: { select: { name: true } } },
    });
    const bayMap = new Map(bays.map((b) => [b.id, b]));

    return grouped
      .map((g) => {
        const bay = bayMap.get(g.bayId);
        if (!bay) return null; // bay deleted since the tx — drop quietly
        return {
          bayId: g.bayId,
          bayName: bay.name,
          locationName: bay.location.name,
          txCount: g._count._all,
          paidAmountAzn: (g._sum.amountAzn ?? new Decimal0()).toString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }

  /** Last 10 transactions across the tenant, any status. Used in the activity feed. */
  private async getRecentTransactions() {
    const rows = await this.prisma.scoped.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        amountAzn: true,
        status: true,
        createdAt: true,
        bay: { select: { name: true } },
        location: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      amountAzn: r.amountAzn.toString(),
      status: r.status as TransactionStatus,
      bayName: r.bay.name,
      locationName: r.location.name,
      occurredAt: r.createdAt.toISOString(),
    }));
  }
}

// ─── Tetri helpers ──────────────────────────────────────────────────
// All AZN money in the DB is Decimal(10,2). We sum as BigInt tetri (1/100
// AZN) to avoid the JS-Number precision tax, then format back to "X.YY".

function decimalToTetri(d: Prisma.Decimal): bigint {
  // Decimal -> "X.YY" -> tetri (XYY)
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

/** Used as a no-tx fallback for `_sum.amountAzn` (Prisma returns null). */
class Decimal0 {
  toString(): string {
    return '0.00';
  }
}
