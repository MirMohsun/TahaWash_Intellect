/**
 * Tenant-self uploads API + browser upload helper.
 *
 * Flow (presigned PUT pattern):
 *   1. Pick a File from <input type="file">.
 *   2. Call POST /tenant/me/uploads/sign with {kind, contentType, sizeBytes}.
 *      Server returns {uploadUrl, publicUrl, key}.
 *   3. fetch(uploadUrl, {method:'PUT', body:file, headers:{'Content-Type':file.type}}).
 *      The file goes directly to R2 — Railway never sees the bytes.
 *   4. For logos: PATCH /tenant/me with {logoUrl: publicUrl}.
 *      For photos: POST /tenant/me/photos with {url: publicUrl}.
 *
 * CORS: R2 must allow PUT from the admin origin. See backend
 * apps/backend/src/modules/uploads/r2.service.ts header for the CORS
 * policy you set on the R2 bucket.
 */
import { api } from './api';
import { compressImage } from './image-compress';
import { superAdminApi } from './super-admin-api';

export type UploadKind = 'logo' | 'photo';

export interface SignedUploadResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresInSec: number;
}

interface SignRequest {
  kind: UploadKind;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  filename?: string;
}

/** Ask the backend to sign a one-time PUT URL. */
export async function signUpload(req: SignRequest): Promise<SignedUploadResponse> {
  const { data } = await api.post<SignedUploadResponse>('/tenant/me/uploads/sign', req);
  return data;
}

/**
 * Sign a URL then PUT the file directly to R2. Returns the public URL
 * to store on the corresponding record (tenant.logoUrl or TenantPhoto.url).
 *
 * Throws:
 *   - UnsupportedTypeError when the file isn't jpeg/png/webp.
 *   - SizeLimitError when file is >8 MB.
 *   - UploadFailedError when the PUT to R2 returns non-2xx.
 */
export async function uploadFile(kind: UploadKind, file: File): Promise<string> {
  if (!isAllowedType(file.type)) {
    throw new UploadError('UNSUPPORTED_TYPE', `Unsupported file type: ${file.type}`);
  }
  // Downscale + recompress in the browser before upload. Keeps the MIME
  // type, so the allowlist + signed Content-Type still match. Falls back to
  // the original file on any failure.
  const prepared = await compressImage(file);
  if (prepared.size > 8 * 1024 * 1024) {
    throw new UploadError('SIZE_LIMIT', 'File is larger than 8 MB.');
  }
  const signed = await signUpload({
    kind,
    contentType: prepared.type as SignRequest['contentType'],
    // The signed URL binds this exact byte count as Content-Length, so the
    // PUT body MUST be `prepared` (not the original) or R2 rejects it.
    sizeBytes: prepared.size,
    filename: file.name.slice(0, 128),
  });
  // Direct PUT to R2. Content-Type MUST match what the server signed or
  // R2 rejects with SignatureDoesNotMatch — that's why we pass the
  // prepared file's type into both signUpload and this header.
  const putRes = await fetch(signed.uploadUrl, {
    method: 'PUT',
    body: prepared,
    headers: { 'Content-Type': prepared.type },
  });
  if (!putRes.ok) {
    throw new UploadError(
      'PUT_FAILED',
      `R2 upload failed (HTTP ${putRes.status}). ${await putRes.text().catch(() => '')}`,
    );
  }
  return signed.publicUrl;
}

/**
 * Super-admin promo image upload. Mirrors uploadFile() but signs against
 * the super-admin uploads endpoint with kind:'promo_image'. Returns the
 * public URL to store on the promo's imageUrl field.
 *
 * Throws the same UploadError codes as uploadFile().
 */
export async function uploadPromoImage(file: File): Promise<string> {
  if (!isAllowedType(file.type)) {
    throw new UploadError('UNSUPPORTED_TYPE', `Unsupported file type: ${file.type}`);
  }
  const prepared = await compressImage(file);
  if (prepared.size > 8 * 1024 * 1024) {
    throw new UploadError('SIZE_LIMIT', 'File is larger than 8 MB.');
  }
  // Super-admin sign endpoint — MUST use the super-admin axios instance so
  // the request carries the super-admin token (the tenant `api` instance has
  // no/empty token here, which 401s against the SuperAdminAuthGuard route).
  const { data: signed } = await superAdminApi.post<SignedUploadResponse>(
    '/super-admin/uploads/sign',
    {
    kind: 'promo_image',
    contentType: prepared.type as SignRequest['contentType'],
    sizeBytes: prepared.size,
    filename: file.name.slice(0, 128),
  });
  const putRes = await fetch(signed.uploadUrl, {
    method: 'PUT',
    body: prepared,
    headers: { 'Content-Type': prepared.type },
  });
  if (!putRes.ok) {
    throw new UploadError(
      'PUT_FAILED',
      `R2 upload failed (HTTP ${putRes.status}). ${await putRes.text().catch(() => '')}`,
    );
  }
  return signed.publicUrl;
}

function isAllowedType(t: string): t is SignRequest['contentType'] {
  return t === 'image/jpeg' || t === 'image/png' || t === 'image/webp';
}

export class UploadError extends Error {
  constructor(
    public readonly code: 'UNSUPPORTED_TYPE' | 'SIZE_LIMIT' | 'PUT_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'UploadError';
  }
}
