/**
 * Typed wrappers around the tenant-facing backend endpoints.
 *
 * Endpoint surface this stage uses (all already shipped in Phase 1.4a/1.4b):
 *   POST   /auth/tenant/login       — username + password → tokens + tenantId
 *   POST   /auth/tenant/refresh     — refresh rotation (called via interceptor)
 *   POST   /auth/tenant/logout      — revoke refresh
 *   GET    /tenant/me               — full tenant row (brand, status, sub dates)
 *
 * Response shapes match what the backend returns; serializers in the backend
 * keep Decimal columns as strings, so amounts stay precise client-side.
 */
import { api } from './api';

export interface TenantLoginResponse {
  tenantId: string;
  tenantUserId: string;
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
  };
}

export interface TenantMe {
  id: string;
  brandName: string;
  legalName: string;
  voen: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ePointMerchantId: string | null;
  themeColor: string;
  logoUrl: string | null;
  descriptionAz: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
  contactPhone: string | null;
  minChargeAmount: string;
  chargeStep: string;
  status: 'pending' | 'active' | 'suspended' | 'hidden';
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export async function tenantLogin(
  username: string,
  password: string,
): Promise<TenantLoginResponse> {
  const { data } = await api.post<TenantLoginResponse>('/auth/tenant/login', {
    username,
    password,
  });
  return data;
}

export async function tenantLogout(refreshToken: string): Promise<void> {
  await api.post('/auth/tenant/logout', { refreshToken });
}

export async function fetchTenantMe(): Promise<TenantMe> {
  const { data } = await api.get<TenantMe>('/tenant/me');
  return data;
}

/**
 * Request a password reset email. Always succeeds at the network layer
 * (backend returns 204 regardless of whether the identifier matched —
 * non-enumeration). UI shows the same "check your email" copy either way.
 */
export async function tenantForgotPassword(usernameOrEmail: string): Promise<void> {
  await api.post('/auth/tenant/forgot-password', { usernameOrEmail });
}

/**
 * Exchange a reset token for a new password. Backend responds 204 on
 * success; throws on RESET_TOKEN_INVALID / RESET_TOKEN_EXPIRED / TENANT_UNAVAILABLE.
 */
export async function tenantResetPassword(token: string, newPassword: string): Promise<void> {
  await api.post('/auth/tenant/reset-password', { token, newPassword });
}
