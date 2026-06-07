import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateBayDto } from './dto/create-bay.dto';
import type { UpdateBayDto } from './dto/update-bay.dto';
import { QrService } from './qr.service';

@Injectable()
export class BaysService {
  private readonly logger = new Logger(BaysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: QrService,
  ) {}

  /**
   * Create a bay under a location owned by the current tenant.
   * Auto-generates a globally-unique qrShortId.
   */
  async create(tenantId: string, locationId: string, dto: CreateBayDto) {
    // Verify the location belongs to the tenant (Prisma extension already
    // restricts visibility, but explicit fetch gives a 404 instead of a
    // confusing FK violation on the next insert).
    const location = await this.prisma.scoped.location.findFirst({
      where: { id: locationId, deletedAt: null },
      select: { id: true },
    });
    if (!location) {
      throw new NotFoundException({
        code: 'LOCATION_NOT_FOUND',
        message: 'Location not found.',
      });
    }

    const qrShortId = await this.qr.generateUniqueShortId();

    const created = await this.prisma.scoped.bay.create({
      data: {
        locationId,
        tenantId,
        name: dto.name,
        hardwareIdentifier: dto.hardwareIdentifier ?? null,
        qrShortId,
      },
    });

    this.logger.log(`Bay "${created.name}" created with qrShortId=${qrShortId}`);
    return serializeBay(created);
  }

  async listForLocation(locationId: string) {
    const items = await this.prisma.scoped.bay.findMany({
      where: { locationId },
      orderBy: { createdAt: 'asc' },
    });
    return items.map(serializeBay);
  }

  async listAll() {
    const items = await this.prisma.scoped.bay.findMany({
      orderBy: { createdAt: 'desc' },
      include: { location: { select: { id: true, name: true, address: true } } },
    });
    return items.map((b) => ({
      ...serializeBay(b),
      location: b.location,
    }));
  }

  async getById(id: string) {
    const bay = await this.prisma.scoped.bay.findUnique({
      where: { id },
      include: {
        location: { select: { id: true, name: true, address: true } },
      },
    });
    if (!bay) throw new NotFoundException({ code: 'BAY_NOT_FOUND' });
    return { ...serializeBay(bay), location: bay.location };
  }

  async update(id: string, dto: UpdateBayDto) {
    await this.assertExists(id);
    const data: Prisma.BayUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.hardwareIdentifier !== undefined) data.hardwareIdentifier = dto.hardwareIdentifier;
    if (dto.status !== undefined) data.status = dto.status;
    try {
      const updated = await this.prisma.scoped.bay.update({ where: { id }, data });
      return serializeBay(updated);
    } catch (err) {
      // Most likely cause is hardwareIdentifier uniqueness collision.
      if (isUniqueViolation(err)) {
        throw new BadRequestException({
          code: 'HARDWARE_IDENTIFIER_TAKEN',
          message: 'Another bay already uses this hardware identifier.',
        });
      }
      throw err;
    }
  }

  /**
   * Regenerate the qrShortId. Rare action — invalidates the old printed
   * sticker, so super-admin / tenant should reprint afterwards.
   */
  async regenerateQr(id: string) {
    await this.assertExists(id);
    const newShortId = await this.qr.generateUniqueShortId();
    const updated = await this.prisma.scoped.bay.update({
      where: { id },
      data: { qrShortId: newShortId },
    });
    this.logger.warn(`Bay ${id} qrShortId regenerated to ${newShortId} (old sticker now invalid)`);
    return serializeBay(updated);
  }

  /** Generate the printable A4 PDF for this bay's QR sticker. */
  async renderQrPdf(id: string): Promise<{
    pdf: Buffer;
    filename: string;
  }> {
    const bay = await this.prisma.scoped.bay.findUnique({
      where: { id },
      include: {
        location: { select: { name: true, address: true } },
        tenant: { select: { brandName: true } },
      },
    });
    if (!bay) throw new NotFoundException({ code: 'BAY_NOT_FOUND' });

    const pdf = await this.qr.renderBayQrPdf({
      qrShortId: bay.qrShortId,
      bayName: bay.name,
      locationName: bay.location.name,
      locationAddress: bay.location.address,
      tenantBrandName: bay.tenant.brandName,
    });

    const safeName = bay.name.replace(/[^a-zA-Z0-9-_]+/g, '-');
    return { pdf, filename: `tahawash-qr-${safeName}-${bay.qrShortId}.pdf` };
  }

  /**
   * Generate a single PDF with one A4 page per bay at a location.
   *
   * Used by the admin's "Print all QR stickers" affordance — the typical
   * use case is a tenant setting up a brand new branch and wanting all
   * their stickers in one print job. Bays come back sorted by createdAt
   * (matching the in-app list order) so the printed stack mirrors what
   * the tenant sees on screen.
   */
  async renderBulkLocationQrPdf(locationId: string): Promise<{
    pdf: Buffer;
    filename: string;
  }> {
    const location = await this.prisma.scoped.location.findFirst({
      where: { id: locationId, deletedAt: null },
      include: {
        tenant: { select: { brandName: true } },
        bays: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!location) {
      throw new NotFoundException({ code: 'LOCATION_NOT_FOUND' });
    }
    if (location.bays.length === 0) {
      throw new NotFoundException({
        code: 'NO_BAYS_TO_PRINT',
        message: 'This location has no bays — add at least one before printing stickers.',
      });
    }

    const pdf = await this.qr.renderBulkBayQrPdf(
      location.bays.map((b) => ({
        qrShortId: b.qrShortId,
        bayName: b.name,
        locationName: location.name,
        locationAddress: location.address,
        tenantBrandName: location.tenant.brandName,
      })),
      {
        tenantBrandName: location.tenant.brandName,
        locationName: location.name,
      },
    );

    const safeLocation = location.name.replace(/[^a-zA-Z0-9-_]+/g, '-');
    return {
      pdf,
      filename: `tahawash-qr-all-${safeLocation}-${location.bays.length}-bays.pdf`,
    };
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.scoped.bay.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException({ code: 'BAY_NOT_FOUND' });
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}

function serializeBay(b: {
  id: string;
  locationId: string;
  tenantId: string;
  name: string;
  hardwareIdentifier: string | null;
  qrShortId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: b.id,
    locationId: b.locationId,
    tenantId: b.tenantId,
    name: b.name,
    hardwareIdentifier: b.hardwareIdentifier,
    qrShortId: b.qrShortId,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}
