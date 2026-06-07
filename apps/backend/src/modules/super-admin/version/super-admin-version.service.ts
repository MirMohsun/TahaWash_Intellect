import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpsertVersionDto } from './dto/upsert-version.dto';
import { compareVersions } from './version-compare';

/**
 * Super-admin force-update controls.
 *
 * The AppVersion table has one row per platform (`ios`, `android`). The
 * mobile app calls `GET /public/version?platform=...` on launch and
 * compares its bundled version against `minimumVersion` — if older,
 * it shows the blocking update modal (per spec round 5).
 *
 * This service is the admin side: list both platforms + upsert one of
 * them. Public read lives in `modules/public/public.service.ts`.
 */
@Injectable()
export class SuperAdminVersionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns both platforms' current config. Missing platforms come back
   * as `null` so the admin UI can show "not configured" rather than
   * blowing up. (Public endpoint 404s on missing — that's correct
   * because the mobile app must NOT proceed without a version policy.)
   */
  async listAll() {
    const rows = await this.prisma.scoped.appVersion.findMany();
    const byPlatform = new Map(rows.map((r) => [r.platform, r]));
    return {
      ios: serializeRow(byPlatform.get('ios') ?? null),
      android: serializeRow(byPlatform.get('android') ?? null),
    };
  }

  async upsert(platform: 'ios' | 'android', dto: UpsertVersionDto) {
    if (compareVersions(dto.minimumVersion, dto.latestVersion) > 0) {
      throw new BadRequestException({
        code: 'MIN_GREATER_THAN_LATEST',
        message: `minimumVersion (${dto.minimumVersion}) cannot be greater than latestVersion (${dto.latestVersion}).`,
      });
    }

    const row = await this.prisma.scoped.appVersion.upsert({
      where: { platform },
      create: {
        platform,
        latestVersion: dto.latestVersion,
        minimumVersion: dto.minimumVersion,
        releaseNotes: dto.releaseNotes ?? null,
      },
      update: {
        latestVersion: dto.latestVersion,
        minimumVersion: dto.minimumVersion,
        releaseNotes: dto.releaseNotes ?? null,
      },
    });
    return serializeRow(row);
  }
}

function serializeRow(
  r: {
    platform: string;
    latestVersion: string;
    minimumVersion: string;
    releaseNotes: string | null;
    updatedAt: Date;
  } | null,
) {
  if (!r) return null;
  return {
    platform: r.platform,
    latestVersion: r.latestVersion,
    minimumVersion: r.minimumVersion,
    releaseNotes: r.releaseNotes,
    updatedAt: r.updatedAt.toISOString(),
  };
}
