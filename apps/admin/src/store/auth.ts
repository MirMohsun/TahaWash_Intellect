/**
 * Tenant-admin auth store.
 *
 * Mirrors the mobile auth Zustand pattern (apps/mobile/src/store/auth.ts):
 *   status: 'unknown' → boot only (token store hasn't been read yet)
 *           'unauth'  → no stored session → redirect /login
 *           'authed'  → session present → render protected shell
 *
 * After login we also fetch /tenant/me up-front so the rest of the app has
 * tenant brand info ready without a render-time flash. The store keeps a
 * snapshot of the tenant for synchronous reads (theme provider, top bar);
 * the canonical source remains TanStack Query via use-tenant-me.
 *
 * On boot the store reads localStorage for a refresh token and, if present,
 * pulls /tenant/me. If that call 401s the api-client interceptor will fire
 * onAuthFailure → logout() → kick to /login.
 */
import { create } from 'zustand';
import { setAuthFailureHandler } from '../lib/api';
import { hasStoredSession, tokenStore } from '../lib/token-store';
import { fetchTenantMe, tenantLogin, tenantLogout, type TenantMe } from '../lib/tenant-api';

type AuthStatus = 'unknown' | 'unauth' | 'authed';

interface AuthState {
  status: AuthStatus;
  tenant: TenantMe | null;

  hydrate: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTenant: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Wire the api-client onAuthFailure hook so a permanent refresh failure
  // forces the store back to 'unauth' without an explicit user action.
  setAuthFailureHandler(() => {
    void get().logout();
  });

  return {
    status: 'unknown',
    tenant: null,

    /**
     * Run once at app boot. If a refresh token exists locally, attempt
     * /tenant/me — that single call exercises the auth pipeline AND seeds
     * the tenant snapshot in one round-trip.
     */
    hydrate: async () => {
      if (!hasStoredSession()) {
        set({ status: 'unauth', tenant: null });
        return;
      }
      try {
        const tenant = await fetchTenantMe();
        set({ status: 'authed', tenant });
      } catch {
        // Either the refresh token is no longer valid (interceptor already
        // cleared tokens + fired onAuthFailure → us) or the server is down.
        // Either way the safe move is to land on /login.
        await tokenStore.clearTokens();
        set({ status: 'unauth', tenant: null });
      }
    },

    login: async (username, password) => {
      const res = await tenantLogin(username, password);
      await tokenStore.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
      const tenant = await fetchTenantMe();
      set({ status: 'authed', tenant });
    },

    logout: async () => {
      const refresh = await tokenStore.getRefreshToken();
      if (refresh) {
        // Best-effort revoke; don't block the UI if the server is unreachable.
        await tenantLogout(refresh).catch(() => undefined);
      }
      await tokenStore.clearTokens();
      set({ status: 'unauth', tenant: null });
    },

    refreshTenant: async () => {
      const tenant = await fetchTenantMe();
      set({ tenant });
    },
  };
});
