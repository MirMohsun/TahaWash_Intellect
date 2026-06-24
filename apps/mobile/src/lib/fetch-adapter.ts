import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

/**
 * React Native fetch-based axios adapter.
 *
 * WHY THIS EXISTS — on RN 0.76 + the New Architecture, axios's default XHR
 * adapter can send a request that REACHES the server (which returns a clean
 * 200) yet never deliver the response back to JS: the `XMLHttpRequest` load
 * callback doesn't fire across the bridge, so axios surfaces `ERR_NETWORK`
 * with no `response`. That's the exact bug that made login fail "even though
 * the OTP appeared in the backend logs." RN's native `fetch` goes through a
 * different bridge path and delivers the response reliably, so we route every
 * axios call through `fetch` instead. (Browser/curl always worked because they
 * never touch RN's XHR shim.)
 *
 * Kept deliberately small — it implements only what this app's client needs:
 * baseURL + url + params, JSON/string bodies, a timeout via AbortController,
 * response header flattening, and axios-shaped success/error results so the
 * existing interceptors (401 refresh, network retry) keep working unchanged.
 */

function buildUrl(config: InternalAxiosRequestConfig): string {
  const path = config.url ?? '';
  const base = config.baseURL ?? '';
  let url = /^https?:\/\//i.test(path) ? path : `${base}${path}`;
  const params = config.params as Record<string, unknown> | undefined;
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  return url;
}

function flattenHeaders(config: InternalAxiosRequestConfig): Record<string, string> {
  const h = config.headers as unknown;
  if (!h) return {};
  const maybe = h as { toJSON?: () => Record<string, string> };
  if (typeof maybe.toJSON === 'function') return maybe.toJSON();
  return { ...(h as Record<string, string>) };
}

export const fetchAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const url = buildUrl(config);
  const method = (config.method ?? 'get').toUpperCase();
  const headers = flattenHeaders(config);

  let body: string | undefined;
  if (config.data != null && method !== 'GET' && method !== 'HEAD') {
    body = typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
  }

  // RN's fetch has no `timeout` option — enforce it with AbortController.
  const controller = new AbortController();
  const timeoutMs = typeof config.timeout === 'number' && config.timeout > 0 ? config.timeout : 0;
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let response: Response;
  try {
    response = await fetch(url, { method, headers, body, signal: controller.signal });
  } catch (err) {
    if (timer) clearTimeout(timer);
    const aborted = (err as Error)?.name === 'AbortError';
    throw new AxiosError(
      aborted ? `timeout of ${timeoutMs}ms exceeded` : 'Network Error',
      aborted ? 'ECONNABORTED' : 'ERR_NETWORK',
      config,
      {},
    );
  }
  if (timer) clearTimeout(timer);

  // Read once as text, then parse — robust to empty bodies (204) and to
  // non-JSON error pages.
  const raw = await response.text();
  let data: unknown = raw;
  if ((config.responseType ?? 'json') === 'json') {
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }
  }

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value: string, key: string) => {
    responseHeaders[key] = value;
  });

  const axiosResponse: AxiosResponse = {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    config,
    request: {},
  };

  const validate = config.validateStatus ?? ((s: number) => s >= 200 && s < 300);
  if (validate(response.status)) return axiosResponse;

  throw new AxiosError(
    `Request failed with status code ${response.status}`,
    response.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
    config,
    {},
    axiosResponse,
  );
};
