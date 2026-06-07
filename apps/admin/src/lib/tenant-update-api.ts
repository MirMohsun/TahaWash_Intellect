/**
 * Tenant self-update — typed wrapper around PATCH /tenant/me.
 *
 * Endpoint shipped in Phase 1.4b. Accepts a partial body — server's
 * UpdateTenantSelfDto treats each field as optional, applying only what
 * the client sends. We do the same: only-fields-actually-changed go in
 * the payload (`buildPatch` below).
 */
import { api } from './api';
import type { TenantMe } from './tenant-api';

/** Subset of TenantMe a tenant is allowed to PATCH on themselves. */
export interface TenantSelfPatch {
  brandName?: string;
  themeColor?: string;
  logoUrl?: string | null;
  contactPhone?: string | null;
  descriptionAz?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
  minChargeAmount?: string;
  chargeStep?: string;
}

export async function patchTenantMe(patch: TenantSelfPatch): Promise<TenantMe> {
  const { data } = await api.patch<TenantMe>('/tenant/me', patch);
  return data;
}

/** Change my password. Backend revokes all refresh tokens on success. */
export async function changeTenantPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await api.post('/auth/tenant/change-password', { currentPassword, newPassword });
}

/** Revoke all refresh tokens for the current tenant user. */
export async function logoutEverywhere(): Promise<void> {
  await api.post('/auth/tenant/logout-everywhere');
}
