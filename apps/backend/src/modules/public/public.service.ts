import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RequestContext } from '../../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Public endpoints — callable without authentication.
 *
 * All Tenant / Location / Bay queries go through `RequestContext.withBypass()`
 * because an anonymous actor would otherwise hit the deny-filter from the
 * tenant-scoping extension.
 *
 * Even with the bypass, we still apply strict filters at the query level
 * (status='active', deletedAt=null) so customers never see suspended,
 * hidden, pending, or deleted tenants.
 */
@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Legal documents (T&C / Privacy) ──────────────────────────

  /**
   * Currently-published legal document for (type, language). Returns
   * 404 if nothing has been published yet — mobile falls back to its
   * bundled i18n copy in that case.
   *
   * Anonymous endpoint — wrapped in withBypass so the scoped query
   * doesn't hit the deny-filter for unauthenticated traffic.
   */
  async getCurrentLegalDocument(type: string, language: string) {
    return RequestContext.withBypass(async () => {
      const row = await this.prisma.scoped.legalDocument.findFirst({
        where: { type, language, isCurrent: true },
      });
      if (!row) {
        throw new NotFoundException({
          code: 'LEGAL_DOCUMENT_NOT_FOUND',
          message: `No published ${type} document for language: ${language}`,
        });
      }
      return {
        type: row.type,
        language: row.language,
        version: row.version,
        sections: coerceLegalSections(row.sections),
        publishedAt: row.publishedAt.toISOString(),
      };
    });
  }

  // ─── App version (force-update) ────────────────────────────────

  async getAppVersion(platform: 'ios' | 'android') {
    const row = await this.prisma.scoped.appVersion.findUnique({
      where: { platform },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'APP_VERSION_NOT_CONFIGURED',
        message: `No app version configured for platform: ${platform}`,
      });
    }
    return {
      platform: row.platform,
      latestVersion: row.latestVersion,
      minimumVersion: row.minimumVersion,
      releaseNotes: row.releaseNotes,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ─── Carwash discovery (map + brand pages) ─────────────────────

  /**
   * Paginated list of active carwashes. Each item includes the tenant's
   * brand presentation + its currently-active locations (so the mobile app
   * can plot them on the map in a single round-trip).
   */
  async listCarwashes(opts: {
    page: number;
    pageSize: number;
    centerLat?: number;
    centerLng?: number;
    radiusKm?: number;
  }) {
    return RequestContext.withBypass(async () => {
      const where: Prisma.TenantWhereInput = {
        status: 'active',
        deletedAt: null,
        // Only include tenants that have at least one active visible location
        // — otherwise the map pin would have nowhere to drop.
        locations: { some: { status: 'active', deletedAt: null } },
      };

      const [tenants, total] = await Promise.all([
        this.prisma.scoped.tenant.findMany({
          where,
          skip: (opts.page - 1) * opts.pageSize,
          take: opts.pageSize,
          orderBy: { brandName: 'asc' },
          include: {
            locations: {
              where: { status: 'active', deletedAt: null },
              orderBy: { name: 'asc' },
              include: { _count: { select: { bays: true } } },
            },
            photos: {
              orderBy: { sortOrder: 'asc' },
              select: { url: true, isHero: true, sortOrder: true },
            },
          },
        }),
        this.prisma.scoped.tenant.count({ where }),
      ]);

      // Map → public shape.
      let items = tenants.map(serializePublicCarwash);

      // Optional geo post-filter (haversine).
      // Done in JS for now because PostGIS ST_DWithin requires a more involved
      // raw query and we have < 100 tenants for the foreseeable future. When
      // we have real scale, swap to PostGIS via Prisma.$queryRaw.
      if (
        typeof opts.centerLat === 'number' &&
        typeof opts.centerLng === 'number' &&
        typeof opts.radiusKm === 'number'
      ) {
        const lat0 = opts.centerLat;
        const lng0 = opts.centerLng;
        const r = opts.radiusKm;
        items = items
          .map((t) => ({
            ...t,
            locations: t.locations
              .map((l) => ({
                ...l,
                distanceKm: haversineKm(lat0, lng0, l.latitude, l.longitude),
              }))
              .filter((l) => l.distanceKm <= r)
              .sort((a, b) => a.distanceKm - b.distanceKm),
          }))
          .filter((t) => t.locations.length > 0);
      }

      return {
        items,
        total,
        page: opts.page,
        pageSize: opts.pageSize,
      };
    });
  }

  /**
   * Public brand page for a single carwash. 404 if not active/deleted/etc.
   */
  async getCarwashById(id: string) {
    return RequestContext.withBypass(async () => {
      const tenant = await this.prisma.scoped.tenant.findFirst({
        where: { id, status: 'active', deletedAt: null },
        include: {
          locations: {
            where: { status: 'active', deletedAt: null },
            orderBy: { name: 'asc' },
            include: { _count: { select: { bays: true } } },
          },
          photos: {
            orderBy: { sortOrder: 'asc' },
            select: { url: true, isHero: true, sortOrder: true },
          },
          services: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              iconKey: true,
              labelAz: true,
              labelRu: true,
              labelEn: true,
              sortOrder: true,
            },
          },
        },
      });
      if (!tenant) {
        throw new NotFoundException({
          code: 'CARWASH_NOT_FOUND',
          message: 'Carwash not found or not currently available.',
        });
      }
      return {
        ...serializePublicCarwash(tenant),
        services: tenant.services.map((s) => ({
          id: s.id,
          iconKey: s.iconKey,
          labelAz: s.labelAz,
          labelRu: s.labelRu,
          labelEn: s.labelEn,
          sortOrder: s.sortOrder,
        })),
      };
    });
  }

  // ─── Promos (Main tab hero card) ───────────────────────────────

  /**
   * Active promos visible on the customer Main tab.
   *
   * A promo is "visible" when:
   *   - status === 'active'           (admin must explicitly publish; see Phase 1.10b)
   *   - startAt <= now <= endAt        (within the configured window)
   *
   * Sorted newest-first so the most recently published campaign sits on top.
   * No pagination — the customer sees at most a handful at a time; an
   * unbounded list isn't a load concern at our scale.
   */
  async listActivePromos() {
    return RequestContext.withBypass(async () => {
      const now = new Date();
      const rows = await this.prisma.scoped.promo.findMany({
        where: {
          status: 'active',
          startAt: { lte: now },
          endAt: { gte: now },
        },
        // Super-admin-controlled order first; createdAt breaks ties.
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });
      return rows.map((p) => ({
        id: p.id,
        imageUrl: p.imageUrl,
        theme: p.theme,
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
      }));
    });
  }

  // ─── Featured tenants (Main tab spotlight) ─────────────────────

  /**
   * Spotlight strip on Main tab. Returns FeaturedTenant rows joined with
   * their tenant + hero photo, filtered to active+visible tenants and
   * sorted by the admin-curated sortOrder ASC.
   *
   * Suspended/hidden/deleted tenants are excluded server-side — the
   * super-admin "feature" toggle doesn't auto-clean stale entries, so
   * we do it on read.
   */
  async listFeatured() {
    return RequestContext.withBypass(async () => {
      const rows = await this.prisma.scoped.featuredTenant.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          tenant: {
            include: {
              locations: {
                where: { status: 'active', deletedAt: null },
                orderBy: { name: 'asc' },
                take: 1,
                select: {
                  id: true,
                  name: true,
                  address: true,
                  latitude: true,
                  longitude: true,
                },
              },
              photos: {
                orderBy: { sortOrder: 'asc' },
                select: { url: true, isHero: true },
              },
            },
          },
        },
      });

      // Exclude tenants that lost their 'active' status since being featured.
      return rows
        .filter((r) => r.tenant.status === 'active' && !r.tenant.deletedAt)
        .map((r) => ({
          tenantId: r.tenantId,
          sortOrder: r.sortOrder,
          tenant: {
            id: r.tenant.id,
            brandName: r.tenant.brandName,
            themeColor: r.tenant.themeColor,
            logoUrl: r.tenant.logoUrl,
            heroPhotoUrl:
              r.tenant.photos.find((p) => p.isHero)?.url ?? r.tenant.photos[0]?.url ?? null,
            firstLocation: r.tenant.locations[0] ?? null,
          },
        }));
    });
  }

  // ─── QR scan lookup ────────────────────────────────────────────

  /**
   * Resolves a printed QR sticker's short ID to a wash bay. Called by the
   * mobile app immediately after a successful camera scan.
   *
   * Returns the bay/location/tenant info that the charge screen needs, or
   * one of four error states:
   *
   *   404 UNKNOWN_DEVICE       — qrShortId not in the bays table
   *   404 DEVICE_DELETED       — tenant or location has been soft-deleted
   *   403 DEVICE_DISABLED      — bay or location is currently disabled
   *   403 TENANT_SUSPENDED     — tenant is suspended/hidden/pending (admin action)
   */
  async getDeviceByQrShortId(qrShortId: string) {
    return RequestContext.withBypass(async () => {
      const bay = await this.prisma.scoped.bay.findUnique({
        where: { qrShortId },
        include: {
          location: { include: { tenant: true } },
        },
      });
      if (!bay) {
        throw new NotFoundException({
          code: 'UNKNOWN_DEVICE',
          message: 'This QR is not recognized.',
        });
      }
      const tenant = bay.location.tenant;
      if (tenant.deletedAt || bay.location.deletedAt) {
        throw new NotFoundException({
          code: 'DEVICE_DELETED',
          message: 'This carwash is no longer available.',
        });
      }
      if (tenant.status !== 'active') {
        // suspended / hidden / pending all surface to the customer the same way:
        // "this carwash isn't taking payments right now".
        throw new ForbiddenException({
          code: 'TENANT_SUSPENDED',
          message: 'This carwash is temporarily unavailable.',
        });
      }
      if (bay.status === 'disabled' || bay.location.status === 'disabled') {
        throw new ForbiddenException({
          code: 'DEVICE_DISABLED',
          message: 'This wash bay is currently disabled.',
        });
      }

      return {
        bay: {
          id: bay.id,
          name: bay.name,
          qrShortId: bay.qrShortId,
        },
        location: {
          id: bay.location.id,
          name: bay.location.name,
          address: bay.location.address,
          latitude: bay.location.latitude,
          longitude: bay.location.longitude,
        },
        tenant: {
          id: tenant.id,
          brandName: tenant.brandName,
          themeColor: tenant.themeColor,
          logoUrl: tenant.logoUrl,
          contactPhone: tenant.contactPhone,
          minChargeAmount: tenant.minChargeAmount.toString(),
          chargeStep: tenant.chargeStep.toString(),
        },
      };
    });
  }
}

// ─── serializers ───────────────────────────────────────────────

interface RawTenantWithRelations {
  id: string;
  brandName: string;
  themeColor: string;
  logoUrl: string | null;
  descriptionAz: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
  contactPhone: string | null;
  minChargeAmount: Prisma.Decimal;
  chargeStep: Prisma.Decimal;
  locations: Array<{
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    contactPhone: string | null;
    workingHours: unknown;
    is24_7: boolean;
    _count: { bays: number };
  }>;
  photos: Array<{ url: string; isHero: boolean; sortOrder: number }>;
}

function serializePublicCarwash(t: RawTenantWithRelations) {
  return {
    id: t.id,
    brandName: t.brandName,
    themeColor: t.themeColor,
    logoUrl: t.logoUrl,
    descriptionAz: t.descriptionAz,
    descriptionRu: t.descriptionRu,
    descriptionEn: t.descriptionEn,
    contactPhone: t.contactPhone,
    minChargeAmount: t.minChargeAmount.toString(),
    chargeStep: t.chargeStep.toString(),
    photoUrls: t.photos.map((p) => p.url),
    heroPhotoUrl: t.photos.find((p) => p.isHero)?.url ?? t.photos[0]?.url ?? null,
    locations: t.locations.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      latitude: l.latitude,
      longitude: l.longitude,
      contactPhone: l.contactPhone,
      workingHours: l.workingHours,
      is24_7: l.is24_7,
      bayCount: l._count.bays,
    })),
  };
}

/** Coerce JSON sections column to a strict shape (defensive — service writes are strict). */
function coerceLegalSections(json: Prisma.JsonValue): Array<{ heading: string; body: string }> {
  if (!Array.isArray(json)) return [];
  const out: Array<{ heading: string; body: string }> = [];
  for (const entry of json) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const obj = entry as Record<string, unknown>;
      const heading = typeof obj.heading === 'string' ? obj.heading : '';
      const body = typeof obj.body === 'string' ? obj.body : '';
      out.push({ heading, body });
    }
  }
  return out;
}

/** Haversine distance in km between two lat/lng points. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
