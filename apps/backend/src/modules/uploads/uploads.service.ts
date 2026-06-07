import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from './r2.service';
import type { SignAdminUploadDto } from './dto/sign-admin-upload.dto';
import type { SignUploadDto } from './dto/sign-upload.dto';

/**
 * Tenant-facing upload service — wraps R2 with a deterministic key
 * scheme so each tenant's objects are namespaced by tenant id.
 *
 * Key shape:  tenants/{tenantId}/{kind}/{epochMs}-{rand}.{ext}
 *   - tenantId prefix means a leaked presigned URL can't be used to
 *     overwrite another tenant's content (the key is committed into the
 *     signature).
 *   - kind partition (logo/photo) is informational — lets you eyeball
 *     a bucket listing and recognize what each file is for.
 *   - epoch + random suffix gives uniqueness without coordinating with
 *     the database — uploads are independent from DB writes.
 *
 * Tracking: every signed key is logged to the UploadedFile ledger so we
 * have an audit trail (who/what/when/size) and so the orphan-cleanup job
 * has a reference set. The insert is best-effort — a tracking hiccup must
 * never block a tenant's upload, and the cleanup job also reconciles
 * directly against live DB references, so an untracked-but-referenced file
 * is still safe.
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly r2: R2Service,
    private readonly prisma: PrismaService,
  ) {}

  async signTenantUpload(
    tenantId: string,
    dto: SignUploadDto,
  ): Promise<{ uploadUrl: string; publicUrl: string; key: string; expiresInSec: number }> {
    const ext = pickExtension(dto.contentType);
    const ts = Date.now();
    const rand = this.r2.randomSuffix();
    const key = `tenants/${tenantId}/${dto.kind}/${ts}-${rand}.${ext}`;
    // Pass sizeBytes so the signed URL binds Content-Length — the DTO's
    // @Max cap is then enforced by R2 at upload time, not just trusted.
    const signed = await this.r2.signPut(key, dto.contentType, dto.sizeBytes);

    await this.track({
      key: signed.key,
      url: signed.publicUrl,
      mimeType: dto.contentType,
      sizeBytes: dto.sizeBytes,
      context: dto.kind === 'logo' ? 'tenant_logo' : 'tenant_photo',
      uploadedBy: 'tenant',
      uploadedById: tenantId,
    });

    return signed;
  }

  /**
   * Sign a platform-level (super-admin) upload — promo banner images. Not
   * tenant-namespaced; lands under `promos/`. The SuperAdminAuthGuard on
   * the controller is what restricts who can call this.
   */
  async signSuperAdminUpload(
    dto: SignAdminUploadDto,
  ): Promise<{ uploadUrl: string; publicUrl: string; key: string; expiresInSec: number }> {
    const ext = pickExtension(dto.contentType);
    const ts = Date.now();
    const rand = this.r2.randomSuffix();
    const key = `promos/${ts}-${rand}.${ext}`;
    const signed = await this.r2.signPut(key, dto.contentType, dto.sizeBytes);

    await this.track({
      key: signed.key,
      url: signed.publicUrl,
      mimeType: dto.contentType,
      sizeBytes: dto.sizeBytes,
      context: 'promo_image',
      uploadedBy: 'super_admin',
      uploadedById: null,
    });

    return signed;
  }

  /**
   * Record a signed upload in the UploadedFile ledger. Best-effort: never
   * throws into the caller (UploadedFile has no tenantId, so we use the
   * raw client — no scoping needed).
   */
  private async track(data: {
    key: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
    context: string;
    uploadedBy: string;
    uploadedById: string | null;
  }): Promise<void> {
    try {
      await this.prisma.uploadedFile.create({ data });
    } catch (err) {
      this.logger.warn(`UploadedFile tracking failed for ${data.key}: ${(err as Error).message}`);
    }
  }
}

function pickExtension(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      // The DTO enum locks this down already, but a default keeps the
      // exhaustive check honest if the union ever grows.
      return 'bin';
  }
}
