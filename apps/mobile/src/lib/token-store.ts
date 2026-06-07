import type { ApiClientTokenStore } from '@tahawash/api-client';
import * as SecureStore from 'expo-secure-store';

/**
 * Mobile token storage — Expo SecureStore.
 *
 * SecureStore uses iOS Keychain + Android EncryptedSharedPreferences, so
 * tokens never sit in plain AsyncStorage. Per spec round 3 the customer
 * stays logged in indefinitely (refresh token rotation handles expiry),
 * so we don't bother with biometric prompts on token read.
 *
 * Keys are namespaced so we can store multiple slots cleanly without
 * collisions if we ever introduce per-actor tokens.
 */
const KEY_ACCESS = 'tahawash.auth.access';
const KEY_REFRESH = 'tahawash.auth.refresh';

export const tokenStore: ApiClientTokenStore = {
  async getAccessToken() {
    return SecureStore.getItemAsync(KEY_ACCESS);
  },
  async getRefreshToken() {
    return SecureStore.getItemAsync(KEY_REFRESH);
  },
  async setTokens(access: string, refresh: string) {
    await SecureStore.setItemAsync(KEY_ACCESS, access);
    await SecureStore.setItemAsync(KEY_REFRESH, refresh);
  },
  async clearTokens() {
    await SecureStore.deleteItemAsync(KEY_ACCESS);
    await SecureStore.deleteItemAsync(KEY_REFRESH);
  },
};
