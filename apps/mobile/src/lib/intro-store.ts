import * as SecureStore from 'expo-secure-store';

/**
 * Intro-seen flag persistence.
 *
 * Stored in SecureStore (same backing as auth tokens — Keychain on iOS,
 * EncryptedSharedPrefs on Android) so it survives app reinstalls per
 * platform conventions and isn't exposed to other apps.
 *
 * Lifecycle:
 *   - Read once by `useIntroState()` at app boot (from app/index.tsx).
 *   - Written by the intro screen when the user reaches the last slide
 *     and taps "Get started" OR taps "Skip" on any slide.
 *   - Never reset by us. (Optional: a future "reset onboarding" debug
 *     toggle in Profile could clear this; not in scope today.)
 *
 * The stored value is the literal string "1"; absence (= null) means
 * the user hasn't completed the intro yet.
 */
const INTRO_KEY = 'tahawash.intro.seen';

export async function getIntroSeen(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(INTRO_KEY);
    return v === '1';
  } catch {
    // SecureStore can fail in rare edge cases (e.g. simulator without
    // entitlements). Fail-open: treat as "seen" so we don't block the
    // user behind an unrecoverable intro loop.
    return true;
  }
}

export async function markIntroSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(INTRO_KEY, '1');
  } catch {
    // Swallow — worst case the user sees the intro again next launch,
    // which is a minor annoyance, not a broken flow.
  }
}
