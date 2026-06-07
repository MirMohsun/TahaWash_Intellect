import type { Customer } from '@tahawash/shared-types';
import { api } from './api';

/**
 * Typed wrappers over the customer-authenticated /me/* endpoints
 * (Phase 1.6). Every call here requires a valid customer JWT —
 * the axios interceptor in @tahawash/api-client attaches it.
 *
 * Failures the caller should anticipate:
 *   - 401 (token expired) → handled silently by the refresh interceptor;
 *     on permanent failure, onAuthFailure kicks us to /(auth)/phone.
 *   - 404 TENANT_NOT_FOUND on addFavorite when the tenant has been
 *     deleted/hidden since the user fetched the list.
 */

export interface FavoriteItem {
  tenantId: string;
  createdAt: string;
  tenant: {
    id: string;
    brandName: string;
    logoUrl: string | null;
    themeColor: string;
    heroPhotoUrl: string | null;
  };
}

/** GET /me */
export async function getMe(): Promise<Customer> {
  const res = await api.get<Customer>('/me');
  return res.data;
}

export interface UpdateMePayload {
  name?: string | null;
  language?: 'az' | 'ru' | 'en';
  pushToken?: string | null;
  pushPlatform?: 'ios' | 'android' | null;
}

/** PATCH /me */
export async function updateMe(payload: UpdateMePayload): Promise<Customer> {
  const res = await api.patch<Customer>('/me', payload);
  return res.data;
}

/** DELETE /me — soft-delete + anonymize (irrecoverable). */
export async function deleteMe(): Promise<{ ok: true }> {
  const res = await api.delete<{ ok: true }>('/me');
  return res.data;
}

export interface PaymentMethod {
  id: string;
  brand: 'visa' | 'mastercard' | 'unionpay' | 'maestro' | 'unknown';
  lastFour: string;
  isDefault: boolean;
  createdAt: string;
}

/** GET /me/payment-methods */
export async function listMyPaymentMethods(): Promise<PaymentMethod[]> {
  const res = await api.get<PaymentMethod[]>('/me/payment-methods');
  return res.data;
}

/** DELETE /me/payment-methods/:id */
export async function deleteMyPaymentMethod(id: string): Promise<{ ok: true }> {
  const res = await api.delete<{ ok: true }>(`/me/payment-methods/${id}`);
  return res.data;
}

/** GET /me/favorites */
export async function listMyFavorites(): Promise<FavoriteItem[]> {
  const res = await api.get<FavoriteItem[]>('/me/favorites');
  return res.data;
}

/** POST /me/favorites/:tenantId (idempotent upsert) */
export async function addFavorite(tenantId: string): Promise<{ ok: true }> {
  const res = await api.post<{ ok: true }>(`/me/favorites/${tenantId}`);
  return res.data;
}

/** DELETE /me/favorites/:tenantId */
export async function removeFavorite(tenantId: string): Promise<{ ok: true }> {
  const res = await api.delete<{ ok: true }>(`/me/favorites/${tenantId}`);
  return res.data;
}
