/**
 * Admin API singleton.
 *
 * Mirrors the mobile-side pattern (apps/mobile/src/lib/api.ts):
 *   - one axios instance per app, created at module load
 *   - tokenStore plugged in so the @tahawash/api-client interceptor adds
 *     `Authorization: Bearer <accessToken>` automatically
 *   - 401 → single-flight POST /auth/tenant/refresh → retry once
 *   - permanent refresh failure → onAuthFailure → auth store kicks the user
 *     back to /login
 *
 * The refreshPath here is tenant-specific (vs the package default which is
 * the customer endpoint).
 */
import { createApiClient } from '@tahawash/api-client';
import { tokenStore } from './token-store';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let authFailureHandler: (() => void) | null = null;
export function setAuthFailureHandler(handler: () => void): void {
  authFailureHandler = handler;
}

export const api = createApiClient({
  baseURL,
  tokenStore,
  refreshPath: '/auth/tenant/refresh',
  onAuthFailure: () => {
    authFailureHandler?.();
  },
  defaultHeaders: {
    'X-Admin-Surface': 'tenant',
  },
});
