import {
  DeleteObjectCommand,
  GetBucketCorsCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  Logger,
  type OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { Env } from '../../config/env.schema';

/**
 * Cloudflare R2 client wrapper.
 *
 * R2 is S3-compatible — the AWS SDK v3 connects to the per-account
 * endpoint at `https://<accountId>.r2.cloudflarestorage.com` and behaves
 * like an S3 bucket for PutObject / GetObject / DeleteObject / signing.
 *
 * Architecture: we generate PRESIGNED PUT URLs and let the admin browser
 * upload directly to R2. The Railway backend never relays the file body
 * itself — bandwidth + memory stay tiny regardless of image size. The
 * trade-off is that R2 CORS must allow PUT from each admin origin (see
 * the README in this folder).
 *
 * Configuration: all R2_* env vars are optional. If any required one is
 * missing at runtime the service throws ServiceUnavailableException with
 * a clear code, so the admin UI can degrade gracefully ("uploads not
 * configured — paste a URL instead").
 */
@Injectable()
export class R2Service implements OnModuleInit {
  private readonly logger = new Logger(R2Service.name);
  private readonly client: S3Client | null;
  private readonly bucket: string | undefined;
  private readonly publicBaseUrl: string | undefined;

  constructor(private readonly config: ConfigService<Env, true>) {
    const accountId = this.config.get('R2_ACCOUNT_ID', { infer: true });
    const accessKeyId = this.config.get('R2_ACCESS_KEY_ID', { infer: true });
    const secretAccessKey = this.config.get('R2_SECRET_ACCESS_KEY', { infer: true });
    this.bucket = this.config.get('R2_BUCKET', { infer: true });
    this.publicBaseUrl = this.config.get('R2_PUBLIC_BASE_URL', { infer: true });

    if (accountId && accessKeyId && secretAccessKey && this.bucket && this.publicBaseUrl) {
      const opts: S3ClientConfig = {
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        // The AWS SDK v3 (>= 3.729) adds a CRC32 checksum to PutObject by
        // default ("WHEN_SUPPORTED"). For a PRESIGNED PUT that checksum is
        // computed over the EMPTY command body at signing time and baked
        // into the URL as `x-amz-checksum-crc32` — so when the browser
        // later PUTs the real file bytes, R2 sees a checksum mismatch and
        // rejects the upload. Forcing WHEN_REQUIRED stops the SDK from
        // injecting a bogus checksum into presigned URLs (R2 doesn't need
        // one). This is THE fix for browser uploads failing post-CORS.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      };
      this.client = new S3Client(opts);
      this.logger.log(`R2 ready — bucket=${this.bucket} publicBase=${this.publicBaseUrl}`);
    } else {
      this.client = null;
      this.logger.warn('R2 not configured — uploads endpoints will return 503');
    }
  }

  /**
   * On boot, make the bucket's CORS policy allow direct browser PUT from
   * each configured admin origin. Browser → R2 presigned uploads fail the
   * preflight unless the BUCKET itself carries a CORS rule (the backend's
   * own enableCors only governs browser → backend calls, not → R2).
   *
   * We treat CORS as infrastructure-as-code: derive the allowed origins
   * from CORS_ORIGINS so every environment self-configures, merge with any
   * origins already on the bucket so staging + prod can share a bucket, and
   * degrade gracefully (log the exact dashboard JSON) if the API token
   * lacks bucket-settings permission.
   */
  async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) return;
    const origins = this.config.get('CORS_ORIGINS', { infer: true });
    await this.ensureCors(origins);
  }

  isEnabled(): boolean {
    return this.client !== null && Boolean(this.bucket) && Boolean(this.publicBaseUrl);
  }

  /**
   * Idempotently ensure the bucket allows browser PUT/GET from `origins`.
   * Best-effort: never throws into boot. On permission failure it logs the
   * exact CORS policy to paste into the Cloudflare dashboard.
   */
  async ensureCors(origins: string[]): Promise<void> {
    if (!this.client || !this.bucket) return;
    const desired = origins.filter((o) => o && o.length > 0);
    if (desired.length === 0) return;

    const buildRule = (allowed: string[]) => ({
      AllowedOrigins: allowed,
      AllowedMethods: ['GET', 'PUT', 'HEAD'],
      // Wildcard covers Content-Type plus any x-amz-* the SDK may add.
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3600,
    });

    try {
      // Merge with whatever is already on the bucket so we don't clobber
      // another environment's origins that point at the same bucket.
      let existing: string[] = [];
      try {
        const got = await this.client.send(new GetBucketCorsCommand({ Bucket: this.bucket }));
        existing = (got.CORSRules ?? []).flatMap((r) => r.AllowedOrigins ?? []);
      } catch {
        // NoSuchCORSConfiguration → bucket simply has no policy yet.
      }
      const merged = Array.from(new Set([...existing, ...desired]));
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: { CORSRules: [buildRule(merged)] },
        }),
      );
      this.logger.log(`R2 CORS ensured for origins: ${merged.join(', ')}`);
    } catch (err) {
      const policy = JSON.stringify([buildRule(desired)], null, 2);
      this.logger.warn(
        `R2 CORS auto-config failed (${(err as Error).message}). Your R2 API ` +
          `token probably lacks bucket-settings permission. Set this policy ` +
          `manually: Cloudflare dashboard → R2 → ${this.bucket} → Settings → ` +
          `CORS Policy → Edit:\n${policy}`,
      );
    }
  }

  /**
   * Generate a one-time PUT URL the client uses to upload a single file.
   *
   * @param key       Storage key (e.g. tenants/cl123/photo/1717000000-abc123.jpg).
   *                  Callers should namespace by tenant id so a leaked sig
   *                  can't overwrite another tenant's objects.
   * @param contentType Must match what the client sends in the PUT header
   *                  byte-for-byte, or R2 rejects with SignatureDoesNotMatch.
   * @param contentLength When provided, it is committed into the signature
   *                  so the upload's actual Content-Length MUST equal it —
   *                  this turns the DTO's byte cap into a HARD limit at R2
   *                  (a client can't claim 1 MB then push 50 MB). The
   *                  browser sets Content-Length from the File automatically,
   *                  so a faithful client always matches.
   * @param expiresInSec Default 5 min — short enough that a leaked URL
   *                  is useless for long.
   */
  async signPut(
    key: string,
    contentType: string,
    contentLength?: number,
    expiresInSec = 300,
  ): Promise<{ uploadUrl: string; publicUrl: string; key: string; expiresInSec: number }> {
    if (!this.client || !this.bucket || !this.publicBaseUrl) {
      throw new ServiceUnavailableException({
        code: 'UPLOADS_DISABLED',
        message: 'R2 storage is not configured on this environment.',
      });
    }
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ...(contentLength && contentLength > 0 ? { ContentLength: contentLength } : {}),
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: expiresInSec });
    return {
      uploadUrl,
      publicUrl: `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`,
      key,
      expiresInSec,
    };
  }

  /**
   * Best-effort delete — never throws into the caller. We log on failure
   * because R2 cleanup is non-critical (we'd rather show a deleted row to
   * the user than abort their action because the cleanup network call
   * flaked).
   */
  async deleteByKey(key: string): Promise<void> {
    if (!this.client || !this.bucket) return;
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`R2 delete failed for ${key}: ${(err as Error).message}`);
    }
  }

  /**
   * Strip the public base URL from a stored URL to recover the storage
   * key, so deleteByKey() can be called after we've persisted only the
   * public URL on a TenantPhoto row. Returns null if the URL doesn't
   * belong to our configured bucket (e.g. a legacy hand-pasted URL).
   */
  keyFromPublicUrl(url: string): string | null {
    if (!this.publicBaseUrl) return null;
    const base = this.publicBaseUrl.replace(/\/$/, '');
    if (!url.startsWith(base + '/')) return null;
    return url.slice(base.length + 1);
  }

  /** Inverse of keyFromPublicUrl — the public URL a given key resolves to. */
  publicUrlForKey(key: string): string | null {
    if (!this.publicBaseUrl) return null;
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }

  /**
   * List every object in the bucket (auto-paginated). Used by the orphan
   * cleanup job to reconcile bucket contents against DB references. Returns
   * an empty array when R2 is disabled.
   */
  async listAllObjects(): Promise<{ key: string; lastModified?: Date }[]> {
    if (!this.client || !this.bucket) return [];
    const out: { key: string; lastModified?: Date }[] = [];
    let token: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, ContinuationToken: token }),
      );
      for (const obj of res.Contents ?? []) {
        if (obj.Key) out.push({ key: obj.Key, lastModified: obj.LastModified });
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return out;
  }

  /** Generate a random suffix for unique object keys. 12 bytes → 24 hex chars. */
  randomSuffix(): string {
    return randomBytes(12).toString('hex');
  }
}
