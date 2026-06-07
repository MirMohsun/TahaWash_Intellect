import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../uploads/r2.service';
import type { CreatePhotoDto } from '../uploads/dto/create-photo.dto';
import type { PatchPhotoDto } from '../uploads/dto/patch-photo.dto';

/**
 * Location photo gallery CRUD — mirrors TenantPhotosService.
 *
 * SECURITY NOTE: LocationPhoto is NOT in TENANT_SCOPED_MODELS (it has no
 * tenantId column — only locationId), so the Prisma scoping extension does
 * NOT auto-filter it. Every operation therefore explicitly verifies that
 * the parent Location belongs to the actor's tenant via the SCOPED Location
 * client (Location IS scoped), then constrains all LocationPhoto queries to
 * that verified locationId. A tenant physically cannot touch another
 * tenant's location photos.
 */
@Injectable()
export class LocationPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  async list(locationId: string) {
    await this.assertLocationOwned(locationId);
    const rows = await this.prisma.locationPhoto.findMany({
      where: { locationId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(serializePhoto);
  }

  async create(locationId: string, dto: CreatePhotoDto) {
    await this.assertLocationOwned(locationId);
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(locationId));

    return this.prisma.$transaction(async (tx) => {
      if (dto.isHero) {
        await tx.locationPhoto.updateMany({
          where: { locationId, isHero: true },
          data: { isHero: false },
        });
      }
      const created = await tx.locationPhoto.create({
        data: {
          locationId,
          url: dto.url,
          sortOrder,
          isHero: dto.isHero ?? false,
        },
      });
      return serializePhoto(created);
    });
  }

  async patch(locationId: string, id: string, dto: PatchPhotoDto) {
    if (dto.sortOrder === undefined && dto.isHero === undefined) {
      throw new BadRequestException({ code: 'EMPTY_PATCH', message: 'Nothing to update.' });
    }
    await this.assertLocationOwned(locationId);
    const existing = await this.prisma.locationPhoto.findFirst({ where: { id, locationId } });
    if (!existing) {
      throw new NotFoundException({ code: 'PHOTO_NOT_FOUND' });
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isHero === true) {
        await tx.locationPhoto.updateMany({
          where: { locationId, isHero: true, NOT: { id } },
          data: { isHero: false },
        });
      }
      const updated = await tx.locationPhoto.update({
        where: { id },
        data: {
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isHero !== undefined ? { isHero: dto.isHero } : {}),
        },
      });
      return serializePhoto(updated);
    });
  }

  async delete(locationId: string, id: string): Promise<void> {
    await this.assertLocationOwned(locationId);
    const existing = await this.prisma.locationPhoto.findFirst({ where: { id, locationId } });
    if (!existing) {
      throw new NotFoundException({ code: 'PHOTO_NOT_FOUND' });
    }
    await this.prisma.locationPhoto.delete({ where: { id } });
    const key = this.r2.keyFromPublicUrl(existing.url);
    if (key) await this.r2.deleteByKey(key);
  }

  /**
   * Throws 404 unless the location exists AND belongs to the current
   * tenant. Uses the SCOPED Location client so a foreign locationId simply
   * resolves to null — never leaks existence across tenants.
   */
  private async assertLocationOwned(locationId: string): Promise<void> {
    const loc = await this.prisma.scoped.location.findFirst({
      where: { id: locationId, deletedAt: null },
      select: { id: true },
    });
    if (!loc) {
      throw new NotFoundException({ code: 'LOCATION_NOT_FOUND', message: 'Location not found.' });
    }
  }

  /** Next sortOrder = max existing for this location + 1, or 0 if empty. */
  private async nextSortOrder(locationId: string): Promise<number> {
    const top = await this.prisma.locationPhoto.findFirst({
      where: { locationId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (top?.sortOrder ?? -1) + 1;
  }
}

function serializePhoto(row: {
  id: string;
  locationId: string;
  url: string;
  sortOrder: number;
  isHero: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    locationId: row.locationId,
    url: row.url,
    sortOrder: row.sortOrder,
    isHero: row.isHero,
    createdAt: row.createdAt.toISOString(),
  };
}
