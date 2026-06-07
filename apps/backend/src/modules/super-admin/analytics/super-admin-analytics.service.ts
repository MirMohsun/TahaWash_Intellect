import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  bakuDateString,
  bakuMonthKey,
  bakuStartOfDayUtc,
  bakuStartOfMonthUtcMonthsAgo,
} from '../../tenant-dashboard/baku-day';
import type { AnalyticsQueryDto } from './dto/analytics-query.dto';

const RANGE_CAP_DAYS = 365;
const DEFAULT_RANGE_DAYS = 90;
const GROWTH_MONTHS = 12;

/**
 * Cross-tenant platform analytics (C6.1).
 *
 * Mirrors the per-tenant `tenant-financials` rollup pattern but
 * crosses every tenant on the platform. Super-admin actors bypass
 * Prisma scoping so the queries here see all rows.
 *
 * Range semantics — `createdAt` for transactions, `paidAt` for the
 * MRR-in-range KPI. Default range = last 90 Baku days (inclusive of
 * today). Hard cap 365 days, matching `tenant-financials`'s
 * RANGE_TOO_LARGE response so the same UI banner works.
 *
 * Tenant growth + MRR-by-month are FIXED 12-month windows (not range
 * dependent) — they're context, not a filter target.
 *
 * Performance: at MVP scale (<10k paid tx/day across platform) the
 * single Transaction.findMany of all paid rows in range is ~50ms.
 * If platform tx volume crosses ~1M/month per tenant we'd want a
 * daily snapshot table or raw SQL; revisit when we see that.
 */
@Injectable()
export class SuperAdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(query: AnalyticsQueryDto) {
    const now = new Date();
    const { fromUtc, toUtc, fromKey, toKey } = resolveRange(query, now);

    // Growth windows — fixed 12 Baku months ending with current month.
    const growthFromUtc = bakuStartOfMonthUtcMonthsAgo(now, GROWTH_MONTHS - 1);

    const [paidTx, newTenantsRows, mrrAllRows, mrrRangeRows] = await Promise.all([
      this.prisma.scoped.transaction.findMany({
        where: {
          createdAt: { gte: fromUtc, lt: toUtc },
          status: { in: ['paid_credited', 'paid_hardware_error'] },
        },
        select: {
          amountAzn: true,
          createdAt: true,
          tenantId: true,
        },
      }),
      this.prisma.scoped.tenant.findMany({
        where: { createdAt: { gte: growthFromUtc } },
        select: { createdAt: true },
      }),
      this.prisma.scoped.subscription.findMany({
        where: { paidAt: { gte: growthFromUtc } },
        select: { amountAzn: true, paidAt: true },
      }),
      this.prisma.scoped.subscription.findMany({
        where: { paidAt: { gte: fromUtc, lt: toUtc } },
        select: { amountAzn: true },
      }),
    ]);

    // ─── Revenue: total + daily series ────────────────────────────
    const dailyBuckets: Record<string, { paidTetri: bigint; txCount: number }> = {};
    let totalTetri = 0n;
    let txCount = 0;
    // Pre-seed daily buckets so days with zero tx still appear in the chart.
    for (let cursor = new Date(fromUtc); cursor < toUtc; ) {
      dailyBuckets[bakuDateString(cursor)] = { paidTetri: 0n, txCount: 0 };
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }

    // ─── Top tenants accumulator ──────────────────────────────────
    // (Top cities by location is deferred — Location has only `address`,
    // no normalized `city` column. Customer.city would surface a
    // different signal — where users LIVE, not where carwashes are —
    // and we'd want to pick the right one once the user has feedback.)
    const byTenant: Record<string, { paidTetri: bigint; txCount: number }> = {};

    for (const row of paidTx) {
      const tetri = decimalToTetri(row.amountAzn);
      totalTetri += tetri;
      txCount += 1;

      const dayKey = bakuDateString(row.createdAt);
      const day = dailyBuckets[dayKey];
      if (day) {
        day.paidTetri += tetri;
        day.txCount += 1;
      }

      const tenantBucket = (byTenant[row.tenantId] ??= { paidTetri: 0n, txCount: 0 });
      tenantBucket.paidTetri += tetri;
      tenantBucket.txCount += 1;
    }

    // ─── New tenants by Baku month (12 buckets) ───────────────────
    const newTenantsByMonth: Record<string, number> = {};
    for (let i = GROWTH_MONTHS - 1; i >= 0; i--) {
      newTenantsByMonth[bakuMonthKey(bakuStartOfMonthUtcMonthsAgo(now, i))] = 0;
    }
    for (const t of newTenantsRows) {
      const key = bakuMonthKey(t.createdAt);
      if (key in newTenantsByMonth) newTenantsByMonth[key] += 1;
    }

    // ─── MRR by Baku month (12 buckets) ───────────────────────────
    const mrrByMonth: Record<string, { paidTetri: bigint; count: number }> = {};
    for (let i = GROWTH_MONTHS - 1; i >= 0; i--) {
      mrrByMonth[bakuMonthKey(bakuStartOfMonthUtcMonthsAgo(now, i))] = {
        paidTetri: 0n,
        count: 0,
      };
    }
    for (const m of mrrAllRows) {
      const key = bakuMonthKey(m.paidAt);
      const bucket = mrrByMonth[key];
      if (bucket) {
        bucket.paidTetri += decimalToTetri(m.amountAzn);
        bucket.count += 1;
      }
    }

    // ─── MRR in current range (KPI card) ──────────────────────────
    let mrrRangeTetri = 0n;
    for (const m of mrrRangeRows) mrrRangeTetri += decimalToTetri(m.amountAzn);

    // ─── New tenants in current range (KPI card) ──────────────────
    // We already have all tenants created in last 12 months. Filter
    // to the range. Avoids a separate query.
    const newTenantsInRange = newTenantsRows.filter(
      (t) => t.createdAt >= fromUtc && t.createdAt < toUtc,
    ).length;

    // ─── Top tenants (top 10 by revenue) — join brand names ────────
    const topTenantIds = Object.entries(byTenant)
      .sort(([, a], [, b]) => Number(b.paidTetri - a.paidTetri))
      .slice(0, 10)
      .map(([tenantId]) => tenantId);

    const topTenantRows = topTenantIds.length
      ? await this.prisma.scoped.tenant.findMany({
          where: { id: { in: topTenantIds } },
          select: { id: true, brandName: true, status: true },
        })
      : [];
    const tenantMap = new Map(topTenantRows.map((t) => [t.id, t]));

    const topTenants = topTenantIds
      .map((id) => {
        const meta = tenantMap.get(id);
        const agg = byTenant[id];
        if (!meta || !agg) return null;
        return {
          tenantId: id,
          brandName: meta.brandName,
          status: meta.status,
          paidAmountAzn: tetriToAznString(agg.paidTetri),
          txCount: agg.txCount,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return {
      range: { from: fromKey, to: toKey },
      revenue: {
        total: tetriToAznString(totalTetri),
        txCount,
        daily: Object.entries(dailyBuckets)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, b]) => ({
            date,
            paidAmountAzn: tetriToAznString(b.paidTetri),
            txCount: b.txCount,
          })),
      },
      growth: {
        newTenants: Object.entries(newTenantsByMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, count]) => ({ month, count })),
        mrrByMonth: Object.entries(mrrByMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, b]) => ({
            month,
            amountAzn: tetriToAznString(b.paidTetri),
            subscriptionCount: b.count,
          })),
      },
      kpis: {
        newTenantsInRange,
        mrrInRange: tetriToAznString(mrrRangeTetri),
        mrrSubscriptionsInRange: mrrRangeRows.length,
      },
      topTenants,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function resolveRange(query: AnalyticsQueryDto, now: Date) {
  const todayStartUtc = bakuStartOfDayUtc(now);
  const defaultFromUtc = new Date(
    todayStartUtc.getTime() - (DEFAULT_RANGE_DAYS - 1) * 24 * 60 * 60 * 1000,
  );
  const fromUtc = query.from ? bakuStartOfDayUtc(new Date(query.from)) : defaultFromUtc;
  // Exclusive upper bound: start of the day AFTER `to`
  const toAnchor = query.to ? new Date(query.to) : now;
  const toUtc = new Date(bakuStartOfDayUtc(toAnchor).getTime() + 24 * 60 * 60 * 1000);

  if (toUtc <= fromUtc) {
    throw new BadRequestException({
      code: 'RANGE_INVALID',
      message: '`to` must be after `from`.',
    });
  }
  const spanDays = Math.round((toUtc.getTime() - fromUtc.getTime()) / (24 * 60 * 60 * 1000));
  if (spanDays > RANGE_CAP_DAYS) {
    throw new BadRequestException({
      code: 'RANGE_TOO_LARGE',
      message: `Range must be ${RANGE_CAP_DAYS} days or fewer.`,
    });
  }

  return {
    fromUtc,
    toUtc,
    fromKey: bakuDateString(fromUtc),
    // `toKey` is the LAST included Baku day, i.e. toUtc - 1ms
    toKey: bakuDateString(new Date(toUtc.getTime() - 1)),
  };
}

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
