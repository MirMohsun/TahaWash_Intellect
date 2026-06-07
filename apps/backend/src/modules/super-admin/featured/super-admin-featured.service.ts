import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AddFeaturedDto } from './dto/add-featured.dto';
import type { ReorderFeaturedDto } from './dto/reorder-featured.dto';

/**
 * Featured tenants — the Wolt-style "carwashes we want to spotlight"
 * strip on the mobile Main tab.
 *
 * Backing table FeaturedTenant has tenantId as the @id (one row per
 * tenant; no duplicates) + a `sortOrder` integer. Lower sortOrder shows
 * first; admin drag-reorder dispatches a `reorder` bulk call.
 */
@Injectable()
export class SuperAdminFeaturedService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List featured tenants ordered by sortOrder ASC. Includes the tenant's
   * brand summary so the admin can render the strip preview.
   */
  async list() {
    const rows = await this.prisma.scoped.featuredTenant.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        tenant: {
          select: {
            id: true,
            brandName: true,
            logoUrl: true,
            themeColor: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });
    return rows.map((r) => ({
      tenantId: r.tenantId,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt.toISOString(),
      tenant: {
        id: r.tenant.id,
        brandName: r.tenant.brandName,
        logoUrl: r.tenant.logoUrl,
        themeColor: r.tenant.themeColor,
        status: r.tenant.status,
        isDeleted: r.tenant.deletedAt !== null,
      },
    }));
  }

  /**
   * Add (or upsert) a featured tenant. Only active, non-deleted tenants
   * are featurable — featuring a suspended/hidden/pending tenant would
   * silently fail later when the mobile filter skips them.
   *
   * If sortOrder is omitted, append to the end (max + 1).
   */
  async add(dto: AddFeaturedDto) {
    const tenant = await this.prisma.scoped.tenant.findFirst({
      where: { id: dto.tenantId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found.',
      });
    }
    if (tenant.status !== 'active') {
      throw new BadRequestException({
        code: 'TENANT_NOT_ACTIVE',
        message: 'Only active tenants can be featured. Activate the tenant first.',
      });
    }

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const max = await this.prisma.scoped.featuredTenant.aggregate({
        _max: { sortOrder: true },
      });
      sortOrder = (max._max.sortOrder ?? -1) + 1;
    }

    const row = await this.prisma.scoped.featuredTenant.upsert({
      where: { tenantId: dto.tenantId },
      create: { tenantId: dto.tenantId, sortOrder },
      update: { sortOrder },
    });
    return {
      tenantId: row.tenantId,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async remove(tenantId: string) {
    const exists = await this.prisma.scoped.featuredTenant.findUnique({
      where: { tenantId },
      select: { tenantId: true },
    });
    if (!exists) {
      throw new NotFoundException({ code: 'FEATURED_NOT_FOUND' });
    }
    await this.prisma.scoped.featuredTenant.delete({ where: { tenantId } });
    return { ok: true };
  }

  /**
   * Bulk reorder. The admin's drag-drop UI sends the full new ordering;
   * any tenantId not in `items` keeps its existing sortOrder.
   *
   * Each item is an upsert: if a tenant was added to the strip by
   * dragging an inactive row in, this also creates the row (after
   * validating the tenant is active).
   */
  async reorder(dto: ReorderFeaturedDto) {
    // Pre-validate all referenced tenants in one shot to give a single
    // 400 if any are bad, rather than partial writes.
    const tenantIds = dto.items.map((i) => i.tenantId);
    const tenants = await this.prisma.scoped.tenant.findMany({
      where: { id: { in: tenantIds }, deletedAt: null, status: 'active' },
      select: { id: true },
    });
    const validIds = new Set(tenants.map((t) => t.id));
    const invalid = dto.items.filter((i) => !validIds.has(i.tenantId));
    if (invalid.length > 0) {
      throw new BadRequestException({
        code: 'INVALID_TENANTS_IN_REORDER',
        message: 'One or more tenants are missing, inactive, or deleted.',
        invalidTenantIds: invalid.map((i) => i.tenantId),
      });
    }

    // Apply upserts sequentially. Volume is small (<= 100 per spec) so
    // perf isn't a concern; explicit per-row upsert preserves
    // createdAt for existing rows.
    for (const item of dto.items) {
      await this.prisma.scoped.featuredTenant.upsert({
        where: { tenantId: item.tenantId },
        create: { tenantId: item.tenantId, sortOrder: item.sortOrder },
        update: { sortOrder: item.sortOrder },
      });
    }

    return this.list();
  }
}
