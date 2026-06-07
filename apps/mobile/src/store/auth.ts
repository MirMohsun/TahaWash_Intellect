import type { Customer } from '@tahawash/shared-types';
import { create } from 'zustand';
import {
  requestOtp as apiRequestOtp,
  verifyOtp as apiVerifyOtp,
  logoutOnServer,
} from '../lib/auth-api';
import { setAuthFailureHandler } from '../lib/api';
import { tokenStore } from '../lib/token-store';

/**
 * Customer auth state.
 *
 * Status state machine:
 *   unknown    → boot only, before we've checked SecureStore
 *   unauth     → no token, show /(auth)/phone
 *   authed     → has a valid customer + tokens, show main app
 *
 * (no 'expired' bucket — the axios interceptor in api-client handles
 *  refresh-token rotation silently; if rotation fails permanently it
 *  fires onAuthFailure which transitions us back to 'unauth')
 *
 * On boot, `hydrate()` reads SecureStore. If a token exists we'd
 * normally also fetch /me to confirm it's still valid; for simplicity
 * we trust the token until the next protected request 401s and the
 * interceptor handles it. The first /me call after boot will catch
 * any revoked-while-offline tokens.
 */

export type AuthStatus = 'unknown' | 'unauth' | 'authed';

interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  refreshToken: string | null;
  customer: Customer | null;

  /** Read tokens from SecureStore. Called once on app boot. */
  hydrate: () => Promise<void>;

  /** Request OTP. Re-thrown error so callers can show status. */
  requestOtp: (phone: string) => Promise<void>;

  /** Verify OTP. Persists tokens + sets state to 'authed' on success. */
  verifyOtp: (phone: string, code: string) => Promise<void>;

  /** Clear server-side + local state. Used by user-driven logout. */
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'unknown',
  accessToken: null,
  refreshToken: null,
  customer: null,

  async hydrate() {
    const access = await tokenStore.getAccessToken();
    const refresh = await tokenStore.getRefreshToken();
    if (access && refresh) {
      // Persisted tokens exist — assume authed until proven otherwise.
      // The /me check that confirms customer.deletedAt etc. runs after
      // navigation lands on the home screen.
      set({
        status: 'authed',
        accessToken: access,
        refreshToken: refresh,
      });
    } else {
      set({ status: 'unauth', accessToken: null, refreshToken: null, customer: null });
    }
  },

  async requestOtp(phone) {
    await apiRequestOtp(phone);
  },

  async verifyOtp(phone, code) {
    const res = await apiVerifyOtp(phone, code);
    await tokenStore.setTokens(res.accessToken, res.refreshToken);
    set({
      status: 'authed',
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      customer: res.customer,
    });
  },

  async logout() {
    const refresh = get().refreshToken;
    if (refresh) {
      // Best-effort — don't block local logout on a network error.
      try {
        await logoutOnServer(refresh);
      } catch {
        /* ignore — local state still wins */
      }
    }
    await tokenStore.clearTokens();
    set({ status: 'unauth', accessToken: null, refreshToken: null, customer: null });
  },
}));

// Wire the auth-failure handler so the axios interceptor's permanent
// refresh-fail bumps us back to 'unauth' (kicks the user to /phone).
setAuthFailureHandler(() => {
  void useAuthStore.getState().logout();
});
