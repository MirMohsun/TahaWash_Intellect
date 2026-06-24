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

/**
 * Transient-network-failure retry. Mobile connections — especially the long
 * path from the device to a remote backend region — drop the occasional
 * request: a TLS handshake that times out, a DNS hiccup, a lost packet, or the
 * server briefly bouncing during a deploy. axios reports all of these as
 * `ERR_NETWORK` with NO `response`. Without a retry, every such blip surfaces
 * to the user as a hard "Network Error" (this is what made login feel broken).
 * We retry a few times with linear backoff; the happy path is untouched (we
 * only ever wait when a request has already failed at the network layer).
 */
const MAX_NETWORK_RETRIES = 3;
// Longer backoff (1.5s, 3s, 4.5s). On connection-rate-throttling networks the
// failure clears after a short cooldown — this automates the "wait a couple
// seconds and it works" that users hit manually, instead of surfacing an error.
const NETWORK_RETRY_BACKOFF_MS = 1500;
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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

  // Response: (1) retry transient network failures, (2) handle 401 refresh.
  let refreshing: Promise<string | null> | null = null;
  instance.interceptors.response.use(
    (r) => r,
    async (error) => {
      const original = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
        _netRetry?: number;
      };

      // (1) Transient network failure — no HTTP response came back at all.
      // Retry with backoff before giving up. Covers flaky mobile links, DNS
      // blips, and the brief unreachability while the backend restarts on a
      // deploy. (A real 4xx/5xx HAS a response and falls through to below.)
      const isNetworkError =
        !!original &&
        !error.response &&
        (error.code === 'ERR_NETWORK' ||
          error.code === 'ECONNABORTED' ||
          error.message === 'Network Error');
      if (isNetworkError) {
        // Abort the orphaned in-flight request first, so a retry can never
        // race a duplicate. (Retrying WITHOUT aborting is what fired the same
        // POST several times and minted multiple OTPs per tap.)
        const req = error.request as { abort?: () => void } | undefined;
        if (req && typeof req.abort === 'function') {
          try {
            req.abort();
          } catch {
            /* best-effort */
          }
        }
        const method = (original.method ?? 'get').toLowerCase();
        const url = original.url ?? '';
        const idempotent = method === 'get' || method === 'head' || method === 'options';
        // The OTP endpoints are SAFE to re-send after a no-response network
        // blip: a repeat request-otp just mints another code (any live code is
        // accepted now), and a verify-otp that got NO response almost never
        // consumed the code. Retrying them automates the "wait a couple seconds
        // and try again — it works" behaviour on connection-throttling networks.
        // Payment POSTs are deliberately NOT retried (double-charge risk).
        const safeAuthPost =
          method === 'post' && /\/auth\/customer\/(request-otp|verify-otp)\b/.test(url);
        const attempt = (original._netRetry ?? 0) + 1;
        if ((idempotent || safeAuthPost) && attempt <= MAX_NETWORK_RETRIES) {
          original._netRetry = attempt;
          await sleep(NETWORK_RETRY_BACKOFF_MS * attempt);
          return instance.request(original);
        }
      }

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
