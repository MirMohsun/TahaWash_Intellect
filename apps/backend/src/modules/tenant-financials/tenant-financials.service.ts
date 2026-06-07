import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { bakuDateString, bakuStartOfDayUtc } from '../tenant-dashboard/baku-day';
import type { FinancialsQueryDto } from './dto/financials-query.dto';

const MAX_RANGE_DAYS = 365;
const TOP_BAYS_LIMIT = 20;
const PAID_STATUSES: TransactionStatus[] = ['paid_credited', 'paid_hardware_error'];

/**
 * Tenant financials rollup — longer-range + per-location + per-bay
 * breakdowns, layered on top of the same paid-tx index used by the
 * dashboard.
 *
 * What's different from /tenant/dashboard:
 *   - configurable date range (default last 30 Baku days; hard cap 365)
 *   - totals include decline + cancel counts (signal for payment-flow
 *     health, useful at the financials level vs the operations-focused
 *     dashboard)
 *   - per-location and per-bay revenue rollups via Prisma groupBy
 *
 * Money sums use BigInt tetri (1/100 AZN) to avoid Number-precision
 * drift — same approach as the dashboard service + mobile.
 */
@Injectable()
export class TenantFinancialsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFinancials(query: FinancialsQueryDto) {
    const { startUtc, endUtc, fromBaku, toBaku, days } = this.resolveRange(query);

    const where: Prisma.TransactionWhereInput = {
      createdAt: { gte: startUtc, lt: endUtc },
    };

    const [totals, dailyRevenue, byLocation, byBay] = await Promise.all([
      this.computeTotals(where),
      this.computeDailySeries(where, fromBaku, days),
      this.computeByLocation(where),
      this.computeByBay(where),
    ]);

    return {
      range: { from: fromBaku, to: toBaku, days },
      totals,
      dailyRevenue,
      byLocation,
      byBay,
    };
  }

  // ─── Range resolution ──────────────────────────────────────────

  private resolveRange(query: FinancialsQueryDto): {
    startUtc: Date;
    endUtc: Date;
    fromBaku: string;
    toBaku: string;
    days: number;
  } {
    const now = new Date();
    const todayBaku = bakuDateString(now);

    const toBaku = query.to ?? todayBaku;
    const fromBaku = query.from ?? offsetBakuDate(toBaku, -29); // 30-day window including 'to'

    const startUtc = bakuStartOfDayUtc(parseBakuDate(fromBaku));
    const toDate = parseBakuDate(toBaku);
    const endUtc = bakuStartOfDayUtc(new Date(toDate.getTime() + 24 * 60 * 60 * 1000));

    const days = Math.round((endUtc.getTime() - startUtc.getTime()) / 86_400_000);
    if (days <= 0) {
      throw new BadRequestException({
        code: 'INVALID_RANGE',
        message: '`from` must be on or before `to`.',
      });
    }
    if (days > MAX_RANGE_DAYS) {
      throw new BadRequestException({
        code: 'RANGE_TOO_LARGE',
        message: `Date range capped at ${MAX_RANGE_DAYS} days — split into smaller windows.`,
      });
    }
    return { startUtc, endUtc, fromBaku, toBaku, days };
  }

  // ─── Totals ────────────────────────────────────────────────────

  private async computeTotals(where: Prisma.TransactionWhereInput) {
    const rows = await this.prisma.scoped.transaction.findMany({
      where,
      select: { amountAzn: true, status: true },
    });

    let paidTetri = 0n;
    let txCount = 0;
    let hardwareErrorCount = 0;
    let declinedCount = 0;
    let cancelledCount = 0;
    for (const r of rows) {
      if (r.status === 'paid_credited' || r.status === 'paid_hardware_error') {
        paidTetri += decimalToTetri(r.amountAzn);
        txCount += 1;
        if (r.status === 'paid_hardware_error') hardwareErrorCount += 1;
      } else if (r.status === 'declined') {
        declinedCount += 1;
      } else if (r.status === 'cancelled') {
        cancelledCount += 1;
      }
    }

    // Average sale only over successful + hardware-error rows (the customer
    // paid in both cases; the latter just didn't dispense water).
    const avgTetri = txCount > 0 ? paidTetri / BigInt(txCount) : 0n;

    return {
      paidAmountAzn: tetriToAznString(paidTetri),
      txCount,
      hardwareErrorCount,
      declinedCount,
      cancelledCount,
      averageSaleAzn: tetriToAznString(avgTetri),
    };
  }

  // ─── Daily series ──────────────────────────────────────────────

  private async computeDailySeries(
    where: Prisma.TransactionWhereInput,
    fromBaku: string,
    days: number,
  ) {
    const rows = await this.prisma.scoped.transaction.findMany({
      where: { ...where, status: { in: PAID_STATUSES } },
      select: { amountAzn: true, createdAt: true },
    });

    // Zero-fill every day in the range so the chart has no gaps.
    const buckets = new Map<string, { paidTetri: bigint; txCount: number }>();
    for (let i = 0; i < days; i++) {
      const day = offsetBakuDate(fromBaku, i);
      buckets.set(day, { paidTetri: 0n, txCount: 0 });
    }
    for (const r of rows) {
      const key = bakuDateString(r.createdAt);
      const bucket = buckets.get(key);
      if (!bucket) continue; // out-of-window safety guard
      bucket.paidTetri += decimalToTetri(r.amountAzn);
      bucket.txCount += 1;
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({
        date,
        paidAmountAzn: tetriToAznString(b.paidTetri),
        txCount: b.txCount,
      }));
  }

  // ─── By location ───────────────────────────────────────────────

  private async computeByLocation(where: Prisma.TransactionWhereInput) {
    const grouped = await this.prisma.scoped.transaction.groupBy({
      by: ['locationId'],
      where: { ...where, status: { in: PAID_STATUSES } },
      _sum: { amountAzn: true },
      _count: { _all: true },
    });

    if (grouped.length === 0) return [];

    const locationIds = grouped.map((g) => g.locationId);
    const locations = await this.prisma.scoped.location.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true },
    });
    const locMap = new Map(locations.map((l) => [l.id, l.name]));

    return grouped
      .map((g) => ({
        locationId: g.locationId,
        locationName: locMap.get(g.locationId) ?? '—',
        paidAmountAzn: (g._sum.amountAzn ?? new ZeroDecimal()).toString(),
        txCount: g._count._all,
      }))
      .sort((a, b) => Number(b.paidAmountAzn) - Number(a.paidAmountAzn));
  }

  // ─── By bay (top 20) ───────────────────────────────────────────

  private async computeByBay(where: Prisma.TransactionWhereInput) {
    const grouped = await this.prisma.scoped.transaction.groupBy({
      by: ['bayId'],
      where: { ...where, status: { in: PAID_STATUSES } },
      _sum: { amountAzn: true },
      _count: { _all: true },
      orderBy: { _sum: { amountAzn: 'desc' } },
      take: TOP_BAYS_LIMIT,
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
        if (!bay) return null;
        return {
          bayId: g.bayId,
          bayName: bay.name,
          locationName: bay.location.name,
          paidAmountAzn: (g._sum.amountAzn ?? new ZeroDecimal()).toString(),
          txCount: g._count._all,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function decimalToTetri(d: Prisma.Decimal): bigint {
  const [int, frac = '00'] = d.toFixed(2).split('.');
  return BigInt(int) * 100n + BigInt(frac.padEnd(2, '0').slice(0, 2));
}

function tetriToAznString(t: bigint): string {
  const major = t / 100n;
  const minor = t % 100n;
  return `${major.toString()}.${minor.toString().padStart(2, '0')}`;
}

function parseBakuDate(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

/** Add `days` (can be negative) to a "YYYY-MM-DD" Baku date string. */
function offsetBakuDate(base: string, days: number): string {
  const d = parseBakuDate(base);
  return bakuDateString(new Date(d.getTime() + days * 86_400_000));
}

/** Sentinel used as a no-tx fallback for `_sum.amountAzn` (Prisma returns null). */
class ZeroDecimal {
  toString(): string {
    return '0.00';
  }
}
