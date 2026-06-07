import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { bakuStartOfMonthUtc } from '../../tenant-dashboard/baku-day';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { ListTenantsQueryDto, TenantListSort } from './dto/list-tenants.query';
import type { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import type { UpdateTenantDto } from './dto/update-tenant.dto';

const PASSWORD_BYTES = 12; // → ~16 base64url chars
const BCRYPT_ROUNDS = 10;

@Injectable()
export class SuperAdminTenantsService {
  private readonly logger = new Logger(SuperAdminTenantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a tenant + its single tenant user in one transaction.
   * Returns the freshly created tenant + the auto-generated password ONCE.
   * (After this response the password is gone — only the hash remains.)
   */
  async create(dto: CreateTenantDto) {
    const username = dto.username ?? slugifyToUsername(dto.brandName);

    // Check uniqueness before the transaction to give better errors.
    const [voenClash, usernameClash] = await Promise.all([
      this.prisma.scoped.tenant.findUnique({ where: { voen: dto.voen } }),
      this.prisma.scoped.tenantUser.findUnique({ where: { username } }),
    ]);
    if (voenClash) {
      throw new ConflictException({
        code: 'VOEN_TAKEN',
        message: 'A tenant with this VOEN already exists.',
      });
    }
    if (usernameClash) {
      throw new ConflictException({
        code: 'USERNAME_TAKEN',
        message: `Username "${username}" is already in use. Pick another.`,
      });
    }

    const generatedPassword = generatePassword();
    const passwordHash = await bcrypt.hash(generatedPassword, BCRYPT_ROUNDS);

    const tenant = await this.prisma.scoped.tenant.create({
      data: {
        brandName: dto.brandName,
        legalName: dto.legalName,
        voen: dto.voen,
        ownerName: dto.ownerName,
        ownerEmail: dto.ownerEmail,
        ownerPhone: dto.ownerPhone,
        themeColor: dto.themeColor ?? '#0E7AE7',
        contactPhone: dto.contactPhone ?? null,
        ePointMerchantId: dto.ePointMerchantId ?? null,
        subscriptionStart: dto.subscriptionStart ? new Date(dto.subscriptionStart) : null,
        subscriptionEnd: dto.subscriptionEnd ? new Date(dto.subscriptionEnd) : null,
        minChargeAmount: dto.minChargeAmount ?? '1.00',
        chargeStep: dto.chargeStep ?? '0.50',
        // Status flow: created → pending. Super-admin flips to 'active' after
        // tenant completes their setup (per spec onboarding flow).
        status: 'pending',
        user: {
          create: {
            username,
            passwordHash,
          },
        },
      },
      include: { user: { select: { id: true, username: true, createdAt: true } } },
    });

    this.logger.log(
      `Created tenant "${tenant.brandName}" (id=${tenant.id}) with user "${username}"`,
    );

    return {
      tenant: serializeTenant(tenant),
      tenantUser: tenant.user,
      generatedPassword,
    };
  }

  async list(query: ListTenantsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sort = query.sort ?? 'createdAt:desc';

    const now = new Date();
    const where: Prisma.TenantWhereInput = { deletedAt: null };

    // Status filter — `expired` is synthetic (subscriptionEnd < now). All
    // other values map straight to the TenantStatus enum.
    if (query.status === 'expired') {
      where.subscriptionEnd = { lt: now };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.q) {
      where.OR = [
        { brandName: { contains: query.q, mode: 'insensitive' } },
        { legalName: { contains: query.q, mode: 'insensitive' } },
        { voen: { contains: query.q } },
      ];
    }

    const monthStart = bakuStartOfMonthUtc(now);

    // Run the page query, total, and BOTH aggregate groupBy's in parallel.
    // Aggregates are global (groupBy across the whole tenants table) — at
    // MVP scale (<100 tenants) this is ~5ms; cheaper than N small queries
    // per row. If platform growth pushes this past ~50ms p99 we'd page
    // the aggregates or persist them.
    const [items, total, bayAgg, txAgg] = await Promise.all([
      this.prisma.scoped.tenant.findMany({
        where,
        orderBy: sortToOrderBy(sort),
        skip,
        take: limit,
      }),
      this.prisma.scoped.tenant.count({ where }),
      this.prisma.scoped.bay.groupBy({
        by: ['tenantId'],
        where: {
          status: 'active',
          location: { status: 'active', deletedAt: null },
          tenant: { deletedAt: null },
        },
        _count: { _all: true },
      }),
      this.prisma.scoped.transaction.groupBy({
        by: ['tenantId'],
        where: {
          createdAt: { gte: monthStart },
          status: { in: ['paid_credited', 'paid_hardware_error'] },
        },
        _sum: { amountAzn: true },
      }),
    ]);

    const bayMap = new Map(bayAgg.map((row) => [row.tenantId, row._count._all]));
    const txMap = new Map(
      txAgg.map((row) => [row.tenantId, (row._sum.amountAzn ?? new Prisma.Decimal(0)).toString()]),
    );

    return {
      items: items.map((t) => ({
        ...serializeTenant(t),
        devicesCount: bayMap.get(t.id) ?? 0,
        monthRevenueAzn: txMap.get(t.id) ?? '0.00',
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const tenant = await this.prisma.scoped.tenant.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { id: true, username: true, lastLoginAt: true } },
        _count: { select: { locations: true, bays: true, transactions: true } },
      },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found.',
      });
    }
    return { ...serializeTenant(tenant), user: tenant.user, counts: tenant._count };
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.assertExists(id);

    // Build the patch carefully — pass only fields that were provided.
    const data: Prisma.TenantUpdateInput = {};
    if (dto.brandName !== undefined) data.brandName = dto.brandName;
    if (dto.legalName !== undefined) data.legalName = dto.legalName;
    if (dto.voen !== undefined) data.voen = dto.voen;
    if (dto.ownerName !== undefined) data.ownerName = dto.ownerName;
    if (dto.ownerEmail !== undefined) data.ownerEmail = dto.ownerEmail;
    if (dto.ownerPhone !== undefined) data.ownerPhone = dto.ownerPhone;
    if (dto.themeColor !== undefined) data.themeColor = dto.themeColor;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone;
    if (dto.ePointMerchantId !== undefined) data.ePointMerchantId = dto.ePointMerchantId;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl;
    if (dto.descriptionAz !== undefined) data.descriptionAz = dto.descriptionAz;
    if (dto.descriptionRu !== undefined) data.descriptionRu = dto.descriptionRu;
    if (dto.descriptionEn !== undefined) data.descriptionEn = dto.descriptionEn;
    if (dto.subscriptionStart !== undefined) {
      data.subscriptionStart = dto.subscriptionStart ? new Date(dto.subscriptionStart) : null;
    }
    if (dto.subscriptionEnd !== undefined) {
      data.subscriptionEnd = dto.subscriptionEnd ? new Date(dto.subscriptionEnd) : null;
    }
    if (dto.minChargeAmount !== undefined) data.minChargeAmount = dto.minChargeAmount;
    if (dto.chargeStep !== undefined) data.chargeStep = dto.chargeStep;

    try {
      const updated = await this.prisma.scoped.tenant.update({
        where: { id },
        data,
      });
      return serializeTenant(updated);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'UNIQUE_CONSTRAINT',
          message: 'A unique field (e.g. VOEN) collides with another tenant.',
        });
      }
      throw err;
    }
  }

  async updateStatus(id: string, dto: UpdateTenantStatusDto) {
    await this.assertExists(id);
    const updated = await this.prisma.scoped.tenant.update({
      where: { id },
      data: { status: dto.status },
    });
    this.logger.log(`Tenant ${id} status set to ${dto.status}`);
    return serializeTenant(updated);
  }

  // ─── internal ────────────────────────────────────────────────

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.scoped.tenant.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found.',
      });
    }
  }
}

// ─── helpers ───────────────────────────────────────────────────

/**
 * Translate a `field:dir` sort key into a Prisma orderBy. For
 * `subscriptionEnd:asc` Prisma's default null-handling pushes null
 * subscriptionEnds to the end, which is what we want — actionable
 * "expires soon" rows come first.
 */
function sortToOrderBy(sort: TenantListSort): Prisma.TenantOrderByWithRelationInput {
  switch (sort) {
    case 'createdAt:asc':
      return { createdAt: 'asc' };
    case 'brandName:asc':
      return { brandName: 'asc' };
    case 'brandName:desc':
      return { brandName: 'desc' };
    case 'subscriptionEnd:asc':
      return { subscriptionEnd: { sort: 'asc', nulls: 'last' } };
    case 'subscriptionEnd:desc':
      return { subscriptionEnd: { sort: 'desc', nulls: 'last' } };
    case 'createdAt:desc':
    default:
      return { createdAt: 'desc' };
  }
}

/**
 * Generate a URL-safe random password. ~16 chars at 12 bytes base64url.
 * Strong enough for super-admin handover; tenant should change it after first login.
 */
function generatePassword(): string {
  return randomBytes(PASSWORD_BYTES)
    .toString('base64')
    .replace(/[+/]/g, '')
    .replace(/=/g, '')
    .slice(0, 16);
}

function slugifyToUsername(brandName: string): string {
  return brandName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Convert a Prisma Tenant row to the JSON shape the frontend expects.
 * Decimal columns become strings; Date columns become ISO strings.
 */
function serializeTenant(t: {
  id: string;
  brandName: string;
  legalName: string;
  voen: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ePointMerchantId: string | null;
  themeColor: string;
  logoUrl: string | null;
  descriptionAz: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
  contactPhone: string | null;
  minChargeAmount: Prisma.Decimal;
  chargeStep: Prisma.Decimal;
  status: string;
  subscriptionStart: Date | null;
  subscriptionEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: t.id,
    brandName: t.brandName,
    legalName: t.legalName,
    voen: t.voen,
    ownerName: t.ownerName,
    ownerEmail: t.ownerEmail,
    ownerPhone: t.ownerPhone,
    ePointMerchantId: t.ePointMerchantId,
    themeColor: t.themeColor,
    logoUrl: t.logoUrl,
    descriptionAz: t.descriptionAz,
    descriptionRu: t.descriptionRu,
    descriptionEn: t.descriptionEn,
    contactPhone: t.contactPhone,
    minChargeAmount: t.minChargeAmount.toString(),
    chargeStep: t.chargeStep.toString(),
    status: t.status,
    subscriptionStart: t.subscriptionStart?.toISOString() ?? null,
    subscriptionEnd: t.subscriptionEnd?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    deletedAt: t.deletedAt?.toISOString() ?? null,
  };
}
