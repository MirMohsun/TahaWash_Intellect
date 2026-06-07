/**
 * Admin token store — localStorage adapter for `@tahawash/api-client`.
 *
 * Tradeoff: localStorage is readable by any script on this origin, which is
 * acceptable for the admin panel because (a) we control every JS file we
 * ship, (b) we set a strong CSP at deploy time, and (c) the alternative —
 * HttpOnly cookies — requires CORS+credentials wiring across the API which
 * we'll layer in if/when security audit calls for it. For MVP, localStorage
 * is the same security posture as the mobile app's SecureStore (encrypted
 * at rest on device; trusted JS at runtime).
 *
 * Keys are namespaced `tahawash.admin.*` to avoid collisions with any other
 * tools the user might run on the same hostname during development.
 */
import type { ApiClientTokenStore } from '@tahawash/api-client';

const ACCESS_KEY = 'tahawash.admin.accessToken';
const REFRESH_KEY = 'tahawash.admin.refreshToken';

export const tokenStore: ApiClientTokenStore = {
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
      // localStorage can throw in private-browsing on some browsers — silently
      // ignore. The user will be asked to re-login on next refresh boundary.
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
export function hasStoredSession(): boolean {
  try {
    return !!localStorage.getItem(REFRESH_KEY);
  } catch {
    return false;
  }
}
