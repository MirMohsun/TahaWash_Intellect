import { createApiClient } from '@tahawash/api-client';
import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { fetchAdapter } from './fetch-adapter';
import { tokenStore } from './token-store';

/**
 * Mobile API singleton.
 *
 * Created once at module load. Used by the rest of the app via:
 *   import { api } from '@/lib/api';
 *   const res = await api.get('/public/version', { params: { platform } });
 *
 * Wired with `tokenStore` (Phase 2.3) so the axios interceptor in
 * @tahawash/api-client automatically:
 *   - attaches `Authorization: Bearer <accessToken>` to every request
 *   - on 401, calls /auth/refresh and retries the original request once
 *     (single-flight; multiple parallel 401s share one refresh call)
 *   - clears tokens + fires onAuthFailure if refresh fails permanently
 *
 * Headers sent on every request (set defaultHeaders):
 *   X-App-Version  → bundled version from app.config.ts (Constants.expoConfig?.version)
 *   X-App-Platform → "ios" | "android" (avoids us guessing from User-Agent server-side)
 *
 * onAuthFailure: the auth Zustand store subscribes to this via a setter
 * exposed in src/store/auth.ts — kicks the user back to the phone-entry
 * screen with the local state cleared.
 */
const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const bundledVersion = Constants.expoConfig?.version ?? '0.0.0';
const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

/** Set by auth store on init so we can call it from the axios interceptor. */
let authFailureHandler: (() => void) | null = null;
export function setAuthFailureHandler(handler: () => void): void {
  authFailureHandler = handler;
}

export const api = createApiClient({
  baseURL,
  tokenStore,
  refreshPath: '/auth/customer/refresh',
  onAuthFailure: () => {
    authFailureHandler?.();
  },
  defaultHeaders: {
    'X-App-Version': bundledVersion,
    'X-App-Platform': platform,
  },
});

// Route ALL mobile HTTP through React Native's native `fetch` instead of
// axios's XHR adapter. On RN 0.76 + New Architecture the XHR adapter can lose
// responses (request reaches the server, 200 returned, but the load callback
// never fires → ERR_NETWORK) — `fetch` uses a reliable bridge path. See
// fetch-adapter.ts. We set it on both the app client AND the bare axios
// default so the api-client's 401-refresh call (which uses plain `axios.post`)
// goes through the same path.
api.defaults.adapter = fetchAdapter;
axios.defaults.adapter = fetchAdapter;

/** What this build identifies as. Re-exported for use in the version-check flow. */
export const appMeta = {
  version: bundledVersion,
  platform,
};
