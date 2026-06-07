import { Platform } from 'react-native';

/**
 * Deep-link URLs for "open this app in the store" actions (force-update).
 *
 * iOS uses the Apple ID assigned by App Store Connect on first submission.
 * Android uses the package id from app.config.ts (`az.tahawash.app`).
 *
 * Until Phase 6 actually submits the iOS app and we get a real Apple ID,
 * we fall back to a search-by-name URL — better than a hard 404. The
 * Android URL is already correct because the package id is locked.
 *
 * Read from env so we can update these per-environment without a code
 * change once submissions exist:
 *   EXPO_PUBLIC_IOS_STORE_URL
 *   EXPO_PUBLIC_ANDROID_STORE_URL
 */

const IOS_FALLBACK = 'https://apps.apple.com/search?term=Tahawash%20carwash';
const ANDROID_FALLBACK = 'https://play.google.com/store/apps/details?id=az.tahawash.app';

export function getStoreUrl(): string {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_IOS_STORE_URL ?? IOS_FALLBACK;
  }
  return process.env.EXPO_PUBLIC_ANDROID_STORE_URL ?? ANDROID_FALLBACK;
}
