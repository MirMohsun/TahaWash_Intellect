import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { bakuDateString, bakuStartOfDayUtc } from '../tenant-dashboard/baku-day';
import type { ListTenantTransactionsQueryDto } from './dto/list-tenant-transactions-query.dto';

const EXPORT_HARD_CAP = 50_000;

/**
 * Tenant-facing transactions queries.
 *
 * All reads go through `prisma.scoped.transaction` so the multi-tenancy
 * extension auto-injects `tenantId = actor.tenantId`. A tenant can NEVER
 * see another tenant's rows — same invariant proven by the 12 unit tests
 * shipped in Phase 1.3.
 *
 * Customer PII surfaced here is limited:
 *   - phone is MASKED ("+994 50 ••• ••67") — the tenant doesn't need
 *     the full number to operate. Support-flow disputes route through
 *     Tahawash super-admin.
 *   - customer name is NOT exposed; the tenant transaction view is
 *     about ops + accounting, not CRM.
 */
@Injectable()
export class TenantTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List (paginated + filtered) ───────────────────────────────

  async list(query: ListTenantTransactionsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where = this.buildWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.scoped.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          bay: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          customer: { select: { phone: true } },
        },
      }),
      this.prisma.scoped.transaction.count({ where }),
    ]);

    return {
      items: items.map(serializeTenantTransactionRow),
      total,
      page,
      pageSize,
    };
  }

  // ─── Detail ────────────────────────────────────────────────────

  async getById(id: string) {
    const tx = await this.prisma.scoped.transaction.findFirst({
      where: { id },
      include: {
        bay: { select: { id: true, name: true } },
        location: { select: { id: true, name: true, address: true } },
        customer: { select: { phone: true } },
      },
    });
    if (!tx) {
      throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND' });
    }
    return {
      ...serializeTenantTransactionRow(tx),
      locationAddress: tx.location.address,
      ePointReference: tx.ePointReference,
      hardwareCreditedAt: tx.hardwareCreditedAt?.toISOString() ?? null,
      errorReason: tx.errorReason,
    };
  }

  // ─── CSV export ────────────────────────────────────────────────

  /**
   * Hard-capped at 50,000 rows to prevent runaway exports. We expect a
   * busy tenant to do ~500 tx/day, so even a year's worth (~180,000)
   * would force them to split the export by date range — acceptable for
   * MVP, will revisit if anyone hits the wall.
   */
  async exportCsv(query: ListTenantTransactionsQueryDto): Promise<{
    csv: string;
    filename: string;
    rowCount: number;
    capped: boolean;
  }> {
    const where = this.buildWhere(query);

    const rows = await this.prisma.scoped.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: EXPORT_HARD_CAP + 1, // peek one extra to detect the cap was hit
      include: {
        bay: { select: { name: true } },
        location: { select: { name: true } },
        customer: { select: { phone: true } },
      },
    });
    const capped = rows.length > EXPORT_HARD_CAP;
    const data = capped ? rows.slice(0, EXPORT_HARD_CAP) : rows;

    const header = [
      'Date (Baku)',
      'Time (Baku)',
      'Status',
      'Amount AZN',
      'Bay',
      'Location',
      'Customer phone',
      'Payment method',
      'Card',
      'ePoint reference',
      'Error reason',
    ];

    const lines: string[] = [header.join(',')];
    for (const r of data) {
      const date = bakuDateString(r.createdAt);
      const shifted = new Date(r.createdAt.getTime() + 4 * 60 * 60 * 1000);
      const time = `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
      const card = r.cardBrand && r.cardLastFour ? `${r.cardBrand} ••${r.cardLastFour}` : '';
      lines.push(
        [
          csvField(date),
          csvField(time),
          csvField(r.status),
          csvField(r.amountAzn.toString()),
          csvField(r.bay.name),
          csvField(r.location.name),
          csvField(r.customer ? maskPhone(r.customer.phone) : ''),
          csvField(r.paymentMethod ?? ''),
          csvField(card),
          csvField(r.ePointReference ?? ''),
          csvField(r.errorReason ?? ''),
        ].join(','),
      );
    }

    const csv = lines.join('\n') + '\n';
    const from = query.from ?? 'all';
    const to = query.to ?? 'now';
    return {
      csv,
      filename: `tahawash-transactions-${from}-to-${to}.csv`,
      rowCount: data.length,
      capped,
    };
  }

  // ─── Shared where-clause builder ───────────────────────────────

  private buildWhere(query: ListTenantTransactionsQueryDto): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = {};
    if (query.status) where.status = query.status as TransactionStatus;
    if (query.locationId) where.locationId = query.locationId;
    if (query.bayId) where.bayId = query.bayId;

    if (query.from || query.to) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.from) {
        // Baku calendar day start → UTC instant
        createdAt.gte = bakuStartOfDayUtc(parseBakuDate(query.from));
      }
      if (query.to) {
        // Exclusive upper bound = start of the day AFTER `to`
        const toDate = parseBakuDate(query.to);
        const nextDay = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);
        createdAt.lt = bakuStartOfDayUtc(nextDay);
      }
      where.createdAt = createdAt;
    }
    return where;
  }
}

// ─── Serializer ────────────────────────────────────────────────────

interface TxRowFromDb {
  id: string;
  customerId: string | null;
  amountAzn: Prisma.Decimal;
  status: TransactionStatus;
  paymentMethod: string | null;
  cardBrand: string | null;
  cardLastFour: string | null;
  ePointReference: string | null;
  hardwareCreditedAt: Date | null;
  errorReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  bay: { id: string; name: string };
  location: { id: string; name: string };
  customer: { phone: string } | null;
}

function serializeTenantTransactionRow(tx: TxRowFromDb) {
  return {
    id: tx.id,
    amountAzn: tx.amountAzn.toString(),
    status: tx.status,
    paymentMethod: tx.paymentMethod,
    cardBrand: tx.cardBrand,
    cardLastFour: tx.cardLastFour,
    occurredAt: tx.createdAt.toISOString(),
    bay: tx.bay,
    location: tx.location,
    customerPhoneMasked: tx.customer ? maskPhone(tx.customer.phone) : null,
    customerAnonymized: !tx.customer,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────

/** "+994501234567" → "+994 50 ••• ••67". Caller has already nullable-guarded. */
function maskPhone(phone: string): string {
  if (phone.startsWith('deleted:')) return '••• ••• ••••';
  const match = /^\+994(\d{2})\d{5}(\d{2})$/.exec(phone);
  if (!match) return phone; // shouldn't happen — DTO enforces format on register
  return `+994 ${match[1]} ••• ••${match[2]}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function parseBakuDate(yyyymmdd: string): Date {
  // Construct a Date that, when subtracted by 4h offset, lands on the Baku
  // calendar day's UTC start. We hand the helper an instant inside the
  // desired day (here noon UTC) — the helper then floors to Baku midnight.
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  // Use UTC noon to avoid any DST-style edge cases (none in Baku, but
  // belt-and-suspenders).
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

/**
 * CSV-quote a field if it contains comma / quote / newline.
 * Doubles internal quotes per RFC 4180.
 */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
