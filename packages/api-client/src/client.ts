/**
 * Tahawash API client — typed axios wrapper.
 *
 * Phase 0 scope: client factory + interceptor scaffold for JWT auth refresh.
 * Phase 1 will add concrete endpoint methods that return typed responses
 * (e.g. `client.tenants.list()`, `client.transactions.create(...)`).
 *
 * The client is INTENDED to be created once per app (mobile, admin) and held
 * in a singleton/provider. Apps inject their own token storage (secure-store
 * on mobile, localStorage on admin) via the `tokenStore` parameter.
 */

import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

export interface ApiClientTokenStore {
  getAccessToken: () => string | null | Promise<string | null>;
  getRefreshToken: () => string | null | Promise<string | null>;
  setTokens: (access: string, refresh: string) => void | Promise<void>;
  clearTokens: () => void | Promise<void>;
}

export interface ApiClientOptions {
  baseURL: string;
  /** Where to store/read auth tokens (platform-specific). */
  tokenStore?: ApiClientTokenStore;
  /** Called when refresh fails permanently — typically navigates to login. */
  onAuthFailure?: () => void;
  /** Extra headers to send with every request (e.g. App-Version). */
  defaultHeaders?: Record<string, string>;
  /**
   * Path the 401-refresh interceptor POSTs to. Each actor type has its own
   * refresh endpoint:
   *   - customer:    /auth/customer/refresh
   *   - tenant:      /auth/tenant/refresh
   *   - super-admin: /auth/super-admin/refresh
   * Defaults to `/auth/customer/refresh` since the mobile customer app
   * was the first consumer of this package.
   */
  refreshPath?: string;
}

export function createApiClient(opts: ApiClientOptions): AxiosInstance {
  const instance = axios.create({
    baseURL: opts.baseURL,
    timeout: 30_000,
    // Force the XHR adapter. axios 1.x auto-picks adapter ('xhr' in browsers /
    // RN, 'http' in Node). On React Native 0.76 with the New Architecture
    // (Fabric/TurboModules), auto-detection occasionally fails because
    // `global.XMLHttpRequest` is patched late by the bridge — when the api
    // client is created at module init, axios sees no XHR and throws
    // "There is no suitable adapter to dispatch the request" the first time
    // the consumer calls a method. Pinning to 'xhr' bypasses the lookup.
    adapter: 'xhr',
    headers: {
      'Content-Type': 'application/json',
      ...opts.defaultHeaders,
    },
  });

  // Request: attach access token if available
  instance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    if (opts.tokenStore) {
      const access = await opts.tokenStore.getAccessToken();
      if (access) {
        config.headers.set('Authorization', `Bearer ${access}`);
      }
    }
    return config;
  });

  // Response: handle 401 → refresh token rotation
  let refreshing: Promise<string | null> | null = null;
  instance.interceptors.response.use(
    (r) => r,
    async (error) => {
      const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      const status = error?.response?.status;

      if (status !== 401 || !opts.tokenStore || original?._retry) {
        return Promise.reject(error);
      }

      original._retry = true;

      // Single-flight refresh — multiple parallel 401s share one refresh call
      if (!refreshing) {
        refreshing = (async () => {
          try {
            const refreshToken = await opts.tokenStore!.getRefreshToken();
            if (!refreshToken) return null;
            const refreshPath = opts.refreshPath ?? '/auth/customer/refresh';
            const res = await axios.post(`${opts.baseURL}${refreshPath}`, { refreshToken });
            const access = res.data?.accessToken as string | undefined;
            const refresh = res.data?.refreshToken as string | undefined;
            if (!access || !refresh) return null;
            await opts.tokenStore!.setTokens(access, refresh);
            return access;
          } catch {
            return null;
          } finally {
            refreshing = null;
          }
        })();
      }

      const newAccess = await refreshing;
      if (!newAccess) {
        await opts.tokenStore.clearTokens();
        opts.onAuthFailure?.();
        return Promise.reject(error);
      }

      original.headers.set('Authorization', `Bearer ${newAccess}`);
      return instance.request(original);
    },
  );

  return instance;
}
