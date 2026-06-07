import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLocationDto } from './dto/create-location.dto';
import type { UpdateLocationStatusDto } from './dto/update-location-status.dto';
import type { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * All methods rely on the multi-tenancy Prisma extension: a tenant actor
   * automatically gets `where: { tenantId: actor.tenantId }` injected, so we
   * don't need to explicitly pass it. Super-admin bypass goes via
   * RequestContext.withBypass() (not used here yet — Phase 1.10).
   */

  async create(tenantId: string, dto: CreateLocationDto) {
    const created = await this.prisma.scoped.location.create({
      data: {
        tenantId,
        name: dto.name,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        contactPhone: dto.contactPhone ?? null,
        is24_7: dto.is24_7 ?? false,
        // Prisma JSON columns: use Prisma.DbNull to write NULL, value otherwise.
        workingHours:
          dto.workingHours == null ? Prisma.DbNull : (dto.workingHours as Prisma.InputJsonValue),
      },
    });
    return serializeLocation(created);
  }

  async list(_tenantId: string) {
    const items = await this.prisma.scoped.location.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { bays: true } } },
    });
    return items.map((l) => ({
      ...serializeLocation(l),
      bayCount: l._count.bays,
    }));
  }

  async getById(id: string) {
    const loc = await this.prisma.scoped.location.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { bays: true } } },
    });
    if (!loc) {
      throw new NotFoundException({
        code: 'LOCATION_NOT_FOUND',
        message: 'Location not found.',
      });
    }
    return { ...serializeLocation(loc), bayCount: loc._count.bays };
  }

  async update(id: string, dto: UpdateLocationDto) {
    await this.assertExists(id);
    const data: Prisma.LocationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone;
    if (dto.is24_7 !== undefined) data.is24_7 = dto.is24_7;
    if (dto.workingHours !== undefined) {
      data.workingHours =
        dto.workingHours === null ? Prisma.DbNull : (dto.workingHours as Prisma.InputJsonValue);
    }
    const updated = await this.prisma.scoped.location.update({
      where: { id },
      data,
    });
    return serializeLocation(updated);
  }

  async updateStatus(id: string, dto: UpdateLocationStatusDto) {
    await this.assertExists(id);
    const updated = await this.prisma.scoped.location.update({
      where: { id },
      data: { status: dto.status },
    });
    return serializeLocation(updated);
  }

  async softDelete(id: string) {
    await this.assertExists(id);
    await this.prisma.scoped.location.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.scoped.location.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException({
        code: 'LOCATION_NOT_FOUND',
        message: 'Location not found.',
      });
    }
  }
}

function serializeLocation(l: {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  contactPhone: string | null;
  workingHours: unknown;
  is24_7: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: l.id,
    tenantId: l.tenantId,
    name: l.name,
    address: l.address,
    latitude: l.latitude,
    longitude: l.longitude,
    contactPhone: l.contactPhone,
    workingHours: l.workingHours,
    is24_7: l.is24_7,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    deletedAt: l.deletedAt?.toISOString() ?? null,
  };
}
