import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreatePromoDto } from './dto/create-promo.dto';
import type { ListPromosQueryDto } from './dto/list-promos-query.dto';
import type { UpdatePromoStatusDto } from './dto/update-promo-status.dto';
import type { UpdatePromoDto } from './dto/update-promo.dto';

/**
 * Promos: marketing banners shown on the mobile Main tab.
 *
 * Lifecycle:
 *   draft     → super-admin is composing
 *   scheduled → ready, startAt is in the future
 *   active    → live (mobile filters status='active' AND startAt<=now<=endAt)
 *   expired   → past endAt; flipped here manually or by a future auto-cron
 *
 * Status is super-admin-managed (PATCH /:id/status). The visibility filter
 * lives in the public/Main-tab query (Phase 1.10c or as needed) — this
 * service just stores + retrieves.
 */
@Injectable()
export class SuperAdminPromosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePromoDto) {
    this.assertDateRange(dto.startAt, dto.endAt);
    if (dto.ctaTargetType && !dto.ctaTargetValue) {
      throw new BadRequestException({
        code: 'CTA_TARGET_VALUE_REQUIRED',
        message: 'ctaTargetValue is required when ctaTargetType is set.',
      });
    }

    const row = await this.prisma.scoped.promo.create({
      data: {
        imageUrl: dto.imageUrl ?? null,
        theme: dto.theme ?? null,
        sortOrder: dto.sortOrder ?? 0,
        titleAz: dto.titleAz,
        titleRu: dto.titleRu,
        titleEn: dto.titleEn,
        bodyAz: dto.bodyAz,
        bodyRu: dto.bodyRu,
        bodyEn: dto.bodyEn,
        ctaTextAz: dto.ctaTextAz ?? null,
        ctaTextRu: dto.ctaTextRu ?? null,
        ctaTextEn: dto.ctaTextEn ?? null,
        ctaTargetType: dto.ctaTargetType ?? null,
        ctaTargetValue: dto.ctaTargetValue ?? null,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        status: dto.status ?? 'draft',
      },
    });
    return serializePromo(row);
  }

  async list(query: ListPromosQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.PromoWhereInput = {};
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.scoped.promo.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.scoped.promo.count({ where }),
    ]);

    return {
      items: items.map(serializePromo),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string) {
    const row = await this.prisma.scoped.promo.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({ code: 'PROMO_NOT_FOUND' });
    }
    return serializePromo(row);
  }

  async update(id: string, dto: UpdatePromoDto) {
    await this.assertExists(id);

    if (dto.startAt !== undefined && dto.endAt !== undefined) {
      this.assertDateRange(dto.startAt, dto.endAt);
    } else if (dto.startAt !== undefined || dto.endAt !== undefined) {
      // Validate against existing dates if only one is updated.
      const current = await this.prisma.scoped.promo.findUnique({
        where: { id },
        select: { startAt: true, endAt: true },
      });
      const start = dto.startAt ? new Date(dto.startAt) : current!.startAt;
      const end = dto.endAt ? new Date(dto.endAt) : current!.endAt;
      if (start.getTime() >= end.getTime()) {
        throw new BadRequestException({
          code: 'INVALID_DATE_RANGE',
          message: 'startAt must be before endAt.',
        });
      }
    }

    const data: Prisma.PromoUpdateInput = {};
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.theme !== undefined) data.theme = dto.theme;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.titleAz !== undefined) data.titleAz = dto.titleAz;
    if (dto.titleRu !== undefined) data.titleRu = dto.titleRu;
    if (dto.titleEn !== undefined) data.titleEn = dto.titleEn;
    if (dto.bodyAz !== undefined) data.bodyAz = dto.bodyAz;
    if (dto.bodyRu !== undefined) data.bodyRu = dto.bodyRu;
    if (dto.bodyEn !== undefined) data.bodyEn = dto.bodyEn;
    if (dto.ctaTextAz !== undefined) data.ctaTextAz = dto.ctaTextAz;
    if (dto.ctaTextRu !== undefined) data.ctaTextRu = dto.ctaTextRu;
    if (dto.ctaTextEn !== undefined) data.ctaTextEn = dto.ctaTextEn;
    if (dto.ctaTargetType !== undefined) data.ctaTargetType = dto.ctaTargetType;
    if (dto.ctaTargetValue !== undefined) data.ctaTargetValue = dto.ctaTargetValue;
    if (dto.startAt !== undefined) data.startAt = new Date(dto.startAt);
    if (dto.endAt !== undefined) data.endAt = new Date(dto.endAt);

    const updated = await this.prisma.scoped.promo.update({ where: { id }, data });
    return serializePromo(updated);
  }

  async updateStatus(id: string, dto: UpdatePromoStatusDto) {
    await this.assertExists(id);
    const updated = await this.prisma.scoped.promo.update({
      where: { id },
      data: { status: dto.status },
    });
    return serializePromo(updated);
  }

  async delete(id: string) {
    await this.assertExists(id);
    await this.prisma.scoped.promo.delete({ where: { id } });
    return { ok: true };
  }

  // ─── internal ────────────────────────────────────────────────

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.scoped.promo.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException({ code: 'PROMO_NOT_FOUND' });
    }
  }

  private assertDateRange(startAt: string, endAt: string): void {
    if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'startAt must be before endAt.',
      });
    }
  }
}

function serializePromo(p: {
  id: string;
  imageUrl: string | null;
  theme: string | null;
  sortOrder: number;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  bodyAz: string;
  bodyRu: string;
  bodyEn: string;
  ctaTextAz: string | null;
  ctaTextRu: string | null;
  ctaTextEn: string | null;
  ctaTargetType: string | null;
  ctaTargetValue: string | null;
  startAt: Date;
  endAt: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    imageUrl: p.imageUrl,
    theme: p.theme,
    sortOrder: p.sortOrder,
    titleAz: p.titleAz,
    titleRu: p.titleRu,
    titleEn: p.titleEn,
    bodyAz: p.bodyAz,
    bodyRu: p.bodyRu,
    bodyEn: p.bodyEn,
    ctaTextAz: p.ctaTextAz,
    ctaTextRu: p.ctaTextRu,
    ctaTextEn: p.ctaTextEn,
    ctaTargetType: p.ctaTargetType,
    ctaTargetValue: p.ctaTargetValue,
    startAt: p.startAt.toISOString(),
    endAt: p.endAt.toISOString(),
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
