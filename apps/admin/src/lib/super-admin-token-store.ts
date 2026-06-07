/**
 * Super-admin token store — localStorage adapter for `@tahawash/api-client`.
 *
 * Parallel to `token-store.ts` (tenant) but under a different namespace so
 * both sessions can coexist in the same browser (tenant + super-admin may
 * both be signed in at once during development / support workflows).
 *
 * Keys: `tahawash.super.*`. Tenant keys are `tahawash.admin.*`.
 */
import type { ApiClientTokenStore } from '@tahawash/api-client';

const ACCESS_KEY = 'tahawash.super.accessToken';
const REFRESH_KEY = 'tahawash.super.refreshToken';

export const superAdminTokenStore: ApiClientTokenStore = {
  getAccessToken: () => {
    try {
      return localStorage.getItem(ACCESS_KEY);
    } catch {
      return null;
    }
  },
  getRefreshToken: () => {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  setTokens: (access: string, refresh: string) => {
    try {
      localStorage.setItem(ACCESS_KEY, access);
      localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      // private-browsing throws — ignore; user re-logs in.
    }
  },
  clearTokens: () => {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      // ignore
    }
  },
};

/** Synchronous check: do we have a refresh token on disk? Used at boot. */
export function hasStoredSuperAdminSession(): boolean {
  try {
    return !!localStorage.getItem(REFRESH_KEY);
  } catch {
    return false;
  }
}
