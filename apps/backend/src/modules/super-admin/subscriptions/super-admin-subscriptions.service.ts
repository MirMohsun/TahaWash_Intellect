import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateSubscriptionDto } from './dto/create-subscription.dto';
import type { ListSubscriptionsQueryDto } from './dto/list-subscriptions.query';

/**
 * Cross-tenant subscription payment log (C5.1).
 *
 * Returns the Subscription rows recorded by super-admins, joined with
 * the parent tenant's brand name for display. Super-admin actors bypass
 * Prisma scoping by default — no `withBypass` wrappers needed.
 *
 * Schema note: `Subscription.method` is a plain string column in
 * Prisma, but the DTO validates against a 3-value enum
 * (bank_transfer / cash / other). The service treats the input as an
 * opaque string for the WHERE clause — if a future migration adds new
 * enum values, the DTO is the single source of truth.
 */
@Injectable()
export class SuperAdminSubscriptionsService {
  private readonly logger = new Logger(SuperAdminSubscriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListSubscriptionsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SubscriptionWhereInput = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.method) where.method = query.method;
    if (query.from || query.to) {
      where.paidAt = {};
      if (query.from) where.paidAt.gte = new Date(query.from);
      if (query.to) where.paidAt.lte = new Date(query.to);
    }

    const [rows, total] = await Promise.all([
      this.prisma.scoped.subscription.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          tenant: { select: { brandName: true } },
        },
      }),
      this.prisma.scoped.subscription.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        tenantBrandName: r.tenant.brandName,
        amountAzn: r.amountAzn.toString(),
        paidAt: r.paidAt.toISOString(),
        periodStart: r.periodStart.toISOString(),
        periodEnd: r.periodEnd.toISOString(),
        method: r.method,
        notes: r.notes,
        recordedBy: r.recordedBy,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Record a manual subscription payment (C5.2). Side effects:
   *
   *   1. Insert the Subscription row (recordedBy = super-admin user id).
   *   2. If the new periodEnd is later than the tenant's current
   *      subscriptionEnd (or the tenant has no subscriptionEnd at all),
   *      bump tenant.subscriptionEnd to periodEnd. Also bump
   *      subscriptionStart if the tenant had none yet.
   *   3. Write an AuditLog row (super_admin actor + action
   *      `subscription.create` + resourceType=tenant) so the trail is
   *      visible from both the audit viewer (4.17) and the per-tenant
   *      activity feed on the detail page (4.5).
   *
   * Atomicity: a single `prisma.$transaction([...])` call wraps the 2-3
   * writes. The (read tenant) → (decide bump) step happens BEFORE the
   * transaction — at MVP single-super-admin scale a concurrent edit is
   * not a concern. Move into an interactive `$transaction(async tx)`
   * if/when the system gains multiple super-admins.
   */
  async create(tenantId: string, dto: CreateSubscriptionDto, superAdminUserId: string) {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (periodEnd <= periodStart) {
      throw new BadRequestException({
        code: 'PERIOD_INVALID',
        message: 'periodEnd must be strictly after periodStart.',
      });
    }

    const tenant = await this.prisma.scoped.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
      select: { id: true, brandName: true, subscriptionStart: true, subscriptionEnd: true },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found.',
      });
    }

    const shouldBumpEnd = !tenant.subscriptionEnd || periodEnd > tenant.subscriptionEnd;
    const shouldBumpStart = !tenant.subscriptionStart && shouldBumpEnd;

    const changes: Record<string, unknown> = {
      amountAzn: dto.amountAzn,
      paidAt: dto.paidAt,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      method: dto.method,
      bumpedSubscriptionEnd: shouldBumpEnd,
    };

    type Op =
      | Prisma.PrismaPromise<unknown>
      | ReturnType<typeof this.prisma.scoped.subscription.create>
      | ReturnType<typeof this.prisma.scoped.tenant.update>
      | ReturnType<typeof this.prisma.scoped.auditLog.create>;

    const ops: Op[] = [
      this.prisma.scoped.subscription.create({
        data: {
          tenantId,
          amountAzn: dto.amountAzn,
          paidAt: new Date(dto.paidAt),
          periodStart,
          periodEnd,
          method: dto.method,
          notes: dto.notes ?? null,
          recordedBy: superAdminUserId,
        },
        include: { tenant: { select: { brandName: true } } },
      }),
    ];

    if (shouldBumpEnd) {
      ops.push(
        this.prisma.scoped.tenant.update({
          where: { id: tenantId },
          data: {
            subscriptionEnd: periodEnd,
            ...(shouldBumpStart ? { subscriptionStart: periodStart } : {}),
          },
          select: {
            id: true,
            subscriptionStart: true,
            subscriptionEnd: true,
          },
        }),
      );
    }

    ops.push(
      this.prisma.scoped.auditLog.create({
        data: {
          actorType: 'super_admin',
          actorId: superAdminUserId,
          action: 'subscription.create',
          resourceType: 'tenant',
          resourceId: tenantId,
          changes: changes as Prisma.InputJsonValue,
        },
      }),
    );

    const results = await this.prisma.$transaction(ops as Prisma.PrismaPromise<unknown>[]);
    const created = results[0] as Prisma.SubscriptionGetPayload<{
      include: { tenant: { select: { brandName: true } } };
    }>;
    const updatedTenant = shouldBumpEnd
      ? (results[1] as { id: string; subscriptionStart: Date | null; subscriptionEnd: Date | null })
      : null;

    this.logger.log(
      `Subscription recorded: tenant=${tenantId} period=${dto.periodStart}..${dto.periodEnd} amount=${dto.amountAzn} method=${dto.method} bumpedEnd=${shouldBumpEnd}`,
    );

    return {
      subscription: {
        id: created.id,
        tenantId: created.tenantId,
        tenantBrandName: created.tenant.brandName,
        amountAzn: created.amountAzn.toString(),
        paidAt: created.paidAt.toISOString(),
        periodStart: created.periodStart.toISOString(),
        periodEnd: created.periodEnd.toISOString(),
        method: created.method,
        notes: created.notes,
        recordedBy: created.recordedBy,
        createdAt: created.createdAt.toISOString(),
      },
      tenant: {
        id: tenantId,
        subscriptionStart: updatedTenant
          ? (updatedTenant.subscriptionStart?.toISOString() ?? null)
          : (tenant.subscriptionStart?.toISOString() ?? null),
        subscriptionEnd: updatedTenant
          ? (updatedTenant.subscriptionEnd?.toISOString() ?? null)
          : (tenant.subscriptionEnd?.toISOString() ?? null),
        bumped: shouldBumpEnd,
      },
    };
  }
}
