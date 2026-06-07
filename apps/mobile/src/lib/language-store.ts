import * as SecureStore from 'expo-secure-store';

/**
 * App-language preference persistence.
 *
 * Stored in SecureStore (same backing as auth tokens + the intro flag) so
 * the user's chosen language survives a full app close/reopen. Without this
 * the boot i18n init fell back to the DEVICE locale every cold start, which
 * reset testers' phones to English regardless of what they picked.
 *
 * Lifecycle:
 *   - Written by the language picker on every change.
 *   - Read once at boot by src/i18n/index.ts to override the device-locale
 *     default with the saved choice.
 */
const LANG_KEY = 'tahawash.language';

export type StoredLanguage = 'az' | 'ru' | 'en';

export async function getStoredLanguage(): Promise<StoredLanguage | null> {
  try {
    const v = await SecureStore.getItemAsync(LANG_KEY);
    return v === 'az' || v === 'ru' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

export async function setStoredLanguage(code: StoredLanguage): Promise<void> {
  try {
    await SecureStore.setItemAsync(LANG_KEY, code);
  } catch {
    // Swallow — worst case the language falls back to device locale next
    // launch, a minor annoyance, not a broken flow.
  }
}
