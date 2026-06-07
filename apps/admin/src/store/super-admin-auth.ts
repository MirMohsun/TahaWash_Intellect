/**
 * Super-admin auth store.
 *
 * Parallel to `store/auth.ts` (tenant), runs independently — the two
 * sessions can coexist in the same browser since their token stores live
 * under different localStorage namespaces (`tahawash.super.*` vs
 * `tahawash.admin.*`) and each has its own axios singleton.
 *
 * State machine:
 *   'unknown' → boot only (token store not yet checked)
 *   'unauth'  → no session → redirect /super-admin/login
 *   'authed'  → session present → render super-admin shell
 *
 * On boot the store reads localStorage for a refresh token and, if present,
 * pulls /auth/super-admin/me. If that 401s the api-client interceptor will
 * fire onAuthFailure → logout() → kick to /super-admin/login.
 */
import { create } from 'zustand';
import { setSuperAdminAuthFailureHandler } from '../lib/super-admin-api';
import {
  fetchSuperAdminMe,
  superAdminLogin,
  superAdminLogout,
  type SuperAdminMe,
} from '../lib/super-admin-api';
import { hasStoredSuperAdminSession, superAdminTokenStore } from '../lib/super-admin-token-store';

type AuthStatus = 'unknown' | 'unauth' | 'authed';

interface SuperAdminAuthState {
  status: AuthStatus;
  principal: SuperAdminMe | null;

  hydrate: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useSuperAdminAuthStore = create<SuperAdminAuthState>((set, get) => {
  setSuperAdminAuthFailureHandler(() => {
    void get().logout();
  });

  return {
    status: 'unknown',
    principal: null,

    hydrate: async () => {
      if (!hasStoredSuperAdminSession()) {
        set({ status: 'unauth', principal: null });
        return;
      }
      try {
        const principal = await fetchSuperAdminMe();
        set({ status: 'authed', principal });
      } catch {
        await superAdminTokenStore.clearTokens();
        set({ status: 'unauth', principal: null });
      }
    },

    login: async (username, password) => {
      const res = await superAdminLogin(username, password);
      await superAdminTokenStore.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
      const principal = await fetchSuperAdminMe();
      set({ status: 'authed', principal });
    },

    logout: async () => {
      const refresh = await superAdminTokenStore.getRefreshToken();
      if (refresh) {
        await superAdminLogout(refresh).catch(() => undefined);
      }
      await superAdminTokenStore.clearTokens();
      set({ status: 'unauth', principal: null });
    },
  };
});
