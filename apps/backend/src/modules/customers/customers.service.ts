import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContext } from '../../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateMeDto } from './dto/update-me.dto';

/**
 * Customer-authenticated endpoints under `/me/*`.
 *
 * All Prisma calls use `this.prisma.scoped` so the tenant-scoping extension
 * auto-filters customer-owned tables (SavedCard, Favorite, Transaction,
 * CustomerRefreshToken) by `customerId = actor.id`. We still pass explicit
 * `customerId` filters in the where clauses for defense-in-depth + clarity.
 */
@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Profile (GET/PATCH/DELETE /me) ────────────────────────────

  async getMe(customerId: string) {
    const customer = await this.prisma.scoped.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND' });
    }
    return serializeCustomer(customer);
  }

  async updateMe(customerId: string, dto: UpdateMeDto) {
    const data: Prisma.CustomerUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.language !== undefined) data.language = dto.language;
    if (dto.pushToken !== undefined) data.pushToken = dto.pushToken;
    if (dto.pushPlatform !== undefined) data.pushPlatform = dto.pushPlatform;

    const updated = await this.prisma.scoped.customer.update({
      where: { id: customerId },
      data,
    });
    return serializeCustomer(updated);
  }

  /**
   * Account deletion. Soft-deletes the customer + anonymizes by:
   *   1. Setting Transaction.customerId = null on all their transactions
   *      (preserves the row for tax retention; severs the link to a person)
   *   2. Hard-deleting SavedCard rows (no reason to keep card tokens)
   *   3. Hard-deleting Favorite rows
   *   4. Hard-deleting CustomerRefreshToken rows (kill all sessions)
   *   5. Setting Customer.deletedAt + nulling PII + masking phone so the
   *      original phone can register again as a new account
   *
   * The customer's current JWT remains technically valid until expiry, but
   * JwtStrategy.validate() rejects any customer with deletedAt set — so the
   * next request after this returns 401.
   *
   * Done sequentially (not in $transaction) because the Prisma extended client
   * has limited transaction support. Each step is idempotent and scoped to
   * the actor's customerId, so partial failure cannot affect another user.
   */
  async deleteMe(customerId: string): Promise<{ ok: true }> {
    this.logger.warn(`Customer account deletion requested for id=${customerId}`);

    await this.prisma.scoped.transaction.updateMany({
      where: { customerId },
      data: { customerId: null },
    });
    await this.prisma.scoped.savedCard.deleteMany({ where: { customerId } });
    await this.prisma.scoped.favorite.deleteMany({ where: { customerId } });
    await this.prisma.scoped.customerRefreshToken.deleteMany({ where: { customerId } });

    await this.prisma.scoped.customer.update({
      where: { id: customerId },
      data: {
        deletedAt: new Date(),
        name: null,
        pushToken: null,
        pushPlatform: null,
        city: null,
        // Mask phone so the original AZ number is freed for re-registration
        // but the unique constraint stays satisfied.
        phone: `deleted:${customerId}`,
      },
    });

    return { ok: true };
  }

  // ─── Favorites (/me/favorites) ─────────────────────────────────

  async addFavorite(customerId: string, tenantId: string): Promise<{ ok: true }> {
    // Verify tenant exists + is currently active before allowing favorite.
    // Bypass: customer actor can read the Tenant table (extension returns
    // null for it), but we still need to bypass to avoid implicit filtering
    // on related models within the same call. Keeping bypass for safety.
    const tenant = await RequestContext.withBypass(() =>
      this.prisma.scoped.tenant.findFirst({
        where: { id: tenantId, status: 'active', deletedAt: null },
        select: { id: true },
      }),
    );
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Carwash not found or not currently available.',
      });
    }

    await this.prisma.scoped.favorite.upsert({
      where: { customerId_tenantId: { customerId, tenantId } },
      create: { customerId, tenantId },
      update: {},
    });
    return { ok: true };
  }

  async removeFavorite(customerId: string, tenantId: string): Promise<{ ok: true }> {
    await this.prisma.scoped.favorite.deleteMany({
      where: { customerId, tenantId },
    });
    return { ok: true };
  }

  async listFavorites(_customerId: string) {
    // Extension auto-scopes Favorite by customerId.
    const items = await this.prisma.scoped.favorite.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: {
            id: true,
            brandName: true,
            logoUrl: true,
            themeColor: true,
            status: true,
            deletedAt: true,
            photos: {
              orderBy: { sortOrder: 'asc' },
              select: { url: true, isHero: true },
              take: 1,
            },
          },
        },
      },
    });

    // Hide tenants that have been suspended / hidden / deleted since the
    // favorite was created (server-side filter — don't show stale links).
    return items
      .filter((f) => f.tenant.status === 'active' && !f.tenant.deletedAt)
      .map((f) => ({
        tenantId: f.tenantId,
        createdAt: f.createdAt.toISOString(),
        tenant: {
          id: f.tenant.id,
          brandName: f.tenant.brandName,
          logoUrl: f.tenant.logoUrl,
          themeColor: f.tenant.themeColor,
          heroPhotoUrl: f.tenant.photos[0]?.url ?? null,
        },
      }));
  }

  // ─── Transactions (read-only here; writes via payment flow Phase 2) ─

  async listMyTransactions(opts: { page: number; pageSize: number }) {
    const [items, total] = await Promise.all([
      this.prisma.scoped.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
        include: {
          tenant: { select: { brandName: true, logoUrl: true, themeColor: true } },
          location: { select: { name: true, address: true } },
          bay: { select: { name: true } },
        },
      }),
      this.prisma.scoped.transaction.count(),
    ]);
    return {
      items: items.map(serializeCustomerTransaction),
      total,
      page: opts.page,
      pageSize: opts.pageSize,
    };
  }

  async getMyTransaction(id: string) {
    const tx = await this.prisma.scoped.transaction.findFirst({
      where: { id },
      include: {
        tenant: { select: { brandName: true, logoUrl: true, themeColor: true } },
        location: { select: { name: true, address: true } },
        bay: { select: { name: true } },
      },
    });
    if (!tx) {
      throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND' });
    }
    return serializeCustomerTransaction(tx);
  }

  // ─── Payment methods (saved cards) ─────────────────────────────

  async listMyPaymentMethods(_customerId: string) {
    const items = await this.prisma.scoped.savedCard.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        brand: true,
        lastFour: true,
        isDefault: true,
        createdAt: true,
      },
    });
    return items.map((c) => ({
      id: c.id,
      brand: c.brand,
      lastFour: c.lastFour,
      isDefault: c.isDefault,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async deleteMyPaymentMethod(customerId: string, id: string): Promise<{ ok: true }> {
    const card = await this.prisma.scoped.savedCard.findFirst({
      where: { id, customerId },
      select: { id: true, isDefault: true },
    });
    if (!card) {
      throw new NotFoundException({ code: 'PAYMENT_METHOD_NOT_FOUND' });
    }
    await this.prisma.scoped.savedCard.delete({ where: { id } });

    // If we removed the default, promote the most recently created remaining
    // card to default (best-effort; ignore if there are none left).
    if (card.isDefault) {
      const next = await this.prisma.scoped.savedCard.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (next) {
        await this.prisma.scoped.savedCard.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    return { ok: true };
  }

  // ─── Notifications (in-app inbox) ──────────────────────────────

  async listMyNotifications(_customerId: string) {
    // scoped extension filters by customerId = actor.id automatically.
    const [rows, unreadCount] = await Promise.all([
      this.prisma.scoped.customerNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.scoped.customerNotification.count({ where: { readAt: null } }),
    ]);
    return { items: rows.map(serializeNotification), unreadCount };
  }

  async markAllNotificationsRead(_customerId: string): Promise<{ ok: true }> {
    await this.prisma.scoped.customerNotification.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}

// ─── serializers ───────────────────────────────────────────────

function serializeNotification(n: {
  id: string;
  type: string;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  bodyAz: string;
  bodyRu: string;
  bodyEn: string;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: n.id,
    type: n.type,
    titleAz: n.titleAz,
    titleRu: n.titleRu,
    titleEn: n.titleEn,
    bodyAz: n.bodyAz,
    bodyRu: n.bodyRu,
    bodyEn: n.bodyEn,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  };
}

function serializeCustomer(c: {
  id: string;
  phone: string;
  name: string | null;
  language: string;
  city: string | null;
  pushToken: string | null;
  pushPlatform: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: c.id,
    phone: c.phone,
    name: c.name,
    language: c.language,
    city: c.city,
    pushToken: c.pushToken,
    pushPlatform: c.pushPlatform,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    deletedAt: c.deletedAt?.toISOString() ?? null,
  };
}

function serializeCustomerTransaction(t: {
  id: string;
  customerId: string | null;
  bayId: string;
  locationId: string;
  tenantId: string;
  amountAzn: Prisma.Decimal;
  status: string;
  ePointReference: string | null;
  paymentMethod: string | null;
  cardBrand: string | null;
  cardLastFour: string | null;
  hardwareCreditedAt: Date | null;
  errorReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  tenant: { brandName: string; logoUrl: string | null; themeColor: string };
  location: { name: string; address: string };
  bay: { name: string };
}) {
  return {
    id: t.id,
    amountAzn: t.amountAzn.toString(),
    status: t.status,
    paymentMethod: t.paymentMethod,
    cardBrand: t.cardBrand,
    cardLastFour: t.cardLastFour,
    ePointReference: t.ePointReference,
    hardwareCreditedAt: t.hardwareCreditedAt?.toISOString() ?? null,
    errorReason: t.errorReason,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    tenant: {
      id: t.tenantId,
      brandName: t.tenant.brandName,
      logoUrl: t.tenant.logoUrl,
      themeColor: t.tenant.themeColor,
    },
    location: {
      id: t.locationId,
      name: t.location.name,
      address: t.location.address,
    },
    bay: {
      id: t.bayId,
      name: t.bay.name,
    },
  };
}
