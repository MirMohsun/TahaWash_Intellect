import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RequestContext } from '../../../common/request-context';
import { PrismaService } from '../../prisma/prisma.service';
import { R2Service } from '../../uploads/r2.service';

/**
 * Daily orphan-file cleanup (Phase 1.7).
 *
 * Direct browser → R2 uploads can leave objects in the bucket that no DB
 * record points at — e.g. the admin uploads a photo (PUT succeeds) then
 * closes the tab before the `POST /photos` row is created, or a signed URL
 * is fetched but never confirmed. Those orphans cost storage forever and
 * are invisible to the UI. This job sweeps them.
 *
 * Algorithm (the bucket is the source of truth, not the ledger):
 *   1. List every object in the bucket.
 *   2. Build the set of keys that are REFERENCED by a live record —
 *      Tenant.logoUrl, TenantPhoto.url, LocationPhoto.url, Promo.imageUrl
 *      (read across all tenants via withBypass).
 *   3. Delete any object that is (a) not referenced AND (b) older than the
 *      grace window — the grace protects an in-flight upload whose DB row
 *      hasn't been written yet.
 *   4. Prune the UploadedFile ledger rows for the deleted keys.
 *
 * Reconciling against live references (not just the ledger) means it also
 * reclaims files whose record was deleted but whose best-effort R2 delete
 * had flaked, and never deletes a referenced file even if it was uploaded
 * outside our tracking.
 */
@Injectable()
export class OrphanFileCleanupService {
  private readonly logger = new Logger(OrphanFileCleanupService.name);

  /** Don't touch objects younger than this — they may be mid-flow uploads. */
  private static readonly GRACE_MS = 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  @Cron('15 0 * * *', {
    name: 'orphan-file-cleanup-daily',
    timeZone: 'Asia/Baku',
  })
  async dailyCron(): Promise<void> {
    if (!this.r2.isEnabled()) {
      this.logger.log('Orphan cleanup skipped — R2 not configured');
      return;
    }
    this.logger.log('Running daily orphan-file cleanup');
    try {
      const result = await this.runCleanup(new Date());
      this.logger.log(
        `Orphan cleanup done: scanned=${result.scanned} referenced=${result.referenced} ` +
          `deleted=${result.deleted} keptYoung=${result.keptYoung}`,
      );
    } catch (err) {
      this.logger.error('Orphan-file cleanup cron failed', err as Error);
      throw err;
    }
  }

  /**
   * Pure-ish entry point — usable from a test or a future super-admin
   * "run now" trigger.
   */
  async runCleanup(now: Date): Promise<{
    scanned: number;
    referenced: number;
    deleted: number;
    keptYoung: number;
  }> {
    const objects = await this.r2.listAllObjects();
    const referenced = await this.collectReferencedKeys();
    const cutoff = now.getTime() - OrphanFileCleanupService.GRACE_MS;

    let deleted = 0;
    let keptYoung = 0;
    const deletedKeys: string[] = [];

    for (const obj of objects) {
      if (referenced.has(obj.key)) continue;
      const ageOk = !obj.lastModified || obj.lastModified.getTime() < cutoff;
      if (!ageOk) {
        keptYoung += 1;
        continue;
      }
      await this.r2.deleteByKey(obj.key);
      deletedKeys.push(obj.key);
      deleted += 1;
    }

    if (deletedKeys.length > 0) {
      try {
        await this.prisma.uploadedFile.deleteMany({ where: { key: { in: deletedKeys } } });
      } catch (err) {
        this.logger.warn(`UploadedFile prune failed: ${(err as Error).message}`);
      }
    }

    return { scanned: objects.length, referenced: referenced.size, deleted, keptYoung };
  }

  /**
   * Every R2 key currently referenced by a live record, across all
   * tenants. URLs that don't resolve to our configured public base
   * (legacy hand-pasted URLs) map to null and are skipped.
   */
  private async collectReferencedKeys(): Promise<Set<string>> {
    const keys = new Set<string>();
    const add = (url: string | null | undefined): void => {
      if (!url) return;
      const key = this.r2.keyFromPublicUrl(url);
      if (key) keys.add(key);
    };

    await RequestContext.withBypass(async () => {
      const [tenants, tenantPhotos, locationPhotos, promos] = await Promise.all([
        this.prisma.scoped.tenant.findMany({
          where: { logoUrl: { not: null } },
          select: { logoUrl: true },
        }),
        this.prisma.scoped.tenantPhoto.findMany({ select: { url: true } }),
        this.prisma.scoped.locationPhoto.findMany({ select: { url: true } }),
        this.prisma.scoped.promo.findMany({ select: { imageUrl: true } }),
      ]);
      for (const t of tenants) add(t.logoUrl);
      for (const p of tenantPhotos) add(p.url);
      for (const p of locationPhotos) add(p.url);
      for (const p of promos) add(p.imageUrl);
    });

    return keys;
  }
}
