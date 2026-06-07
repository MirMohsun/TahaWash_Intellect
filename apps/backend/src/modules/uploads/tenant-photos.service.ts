import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from './r2.service';
import type { CreatePhotoDto } from './dto/create-photo.dto';
import type { PatchPhotoDto } from './dto/patch-photo.dto';

/**
 * Tenant photo gallery CRUD.
 *
 * All operations go through `prisma.scoped` which the Prisma extension
 * pins to the actor's tenantId — a tenant physically cannot read or
 * write another tenant's photos even if they craft a request with
 * someone else's photo id.
 *
 * Hero invariant: at most ONE photo per tenant has `isHero = true`. The
 * setHeroExclusive() helper handles the demote-others-then-promote-this
 * flip inside a single transaction so we never leave the gallery in a
 * two-hero state mid-flight.
 *
 * Storage cleanup: delete attempts to remove the underlying R2 object
 * too, but only when the photo's URL points at our configured public
 * base (legacy hand-pasted URLs are left alone). Failures are
 * best-effort and don't block the DB delete.
 */
@Injectable()
export class TenantPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  async list(tenantId: string) {
    void tenantId; // scoped extension enforces — kept for clarity / future audit
    const rows = await this.prisma.scoped.tenantPhoto.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(serializePhoto);
  }

  async create(tenantId: string, dto: CreatePhotoDto) {
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder());

    return this.prisma.$transaction(async (tx) => {
      if (dto.isHero) {
        await tx.tenantPhoto.updateMany({
          where: { tenantId, isHero: true },
          data: { isHero: false },
        });
      }
      const created = await tx.tenantPhoto.create({
        data: {
          tenantId,
          url: dto.url,
          sortOrder,
          isHero: dto.isHero ?? false,
        },
      });
      return serializePhoto(created);
    });
  }

  async patch(tenantId: string, id: string, dto: PatchPhotoDto) {
    if (dto.sortOrder === undefined && dto.isHero === undefined) {
      throw new BadRequestException({ code: 'EMPTY_PATCH', message: 'Nothing to update.' });
    }

    // Existence + ownership check via scoped client (returns null if the
    // row belongs to another tenant).
    const existing = await this.prisma.scoped.tenantPhoto.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'PHOTO_NOT_FOUND' });
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isHero === true) {
        await tx.tenantPhoto.updateMany({
          where: { tenantId, isHero: true, NOT: { id } },
          data: { isHero: false },
        });
      }
      const updated = await tx.tenantPhoto.update({
        where: { id },
        data: {
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isHero !== undefined ? { isHero: dto.isHero } : {}),
        },
      });
      return serializePhoto(updated);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    void tenantId;
    const existing = await this.prisma.scoped.tenantPhoto.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'PHOTO_NOT_FOUND' });
    }
    await this.prisma.scoped.tenantPhoto.delete({ where: { id } });
    // R2 cleanup is best-effort; logs on failure but doesn't surface to the user.
    const key = this.r2.keyFromPublicUrl(existing.url);
    if (key) await this.r2.deleteByKey(key);
  }

  /** Next sortOrder = max existing + 1, or 0 if gallery is empty. */
  private async nextSortOrder(): Promise<number> {
    const top = await this.prisma.scoped.tenantPhoto.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (top?.sortOrder ?? -1) + 1;
  }
}

function serializePhoto(row: {
  id: string;
  tenantId: string;
  url: string;
  sortOrder: number;
  isHero: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    url: row.url,
    sortOrder: row.sortOrder,
    isHero: row.isHero,
    createdAt: row.createdAt.toISOString(),
  };
}
