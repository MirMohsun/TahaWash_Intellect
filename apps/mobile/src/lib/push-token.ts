import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Push notification helpers.
 *
 * Mobile-side glue between expo-notifications and the backend's
 * PATCH /me {pushToken, pushPlatform} endpoint. The backend's
 * PUSH_DELIVERY BullMQ queue (Phase 1.10a) processes outgoing pushes
 * via the configured PushProvider (mock today, FCM when wired).
 *
 * In dev / Expo Go: getDevicePushToken returns an ExponentPushToken
 * which delivers through Expo's push service — no FCM creds needed.
 * In production EAS dev/preview/prod builds with FCM credentials
 * wired (Phase 6 store submission), Expo silently routes through FCM
 * under the hood. Same token shape, same delivery semantics for our
 * server.
 *
 * Foreground notification handler is set ONCE here at module load
 * (process-wide). Tap response listeners are set per-mount inside
 * use-push-registration.ts.
 */

// ─── foreground handler (set ONCE per process) ───────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // expo-notifications SDK 52 split shouldShowAlert into banner+list;
    // keep both true so the notification visibly arrives whether the
    // user is on iOS (banner) or Android (drawer).
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Android notification channel (required SDK 26+) ─────────────

/**
 * Android requires a registered notification channel for every push.
 * One channel ('default') is enough for MVP — Phase 6 may split into
 * "marketing" vs "transactional" for finer user-side control.
 *
 * Safe to call repeatedly; OS treats it as idempotent.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0E7AE7',
  });
}

// ─── device token ────────────────────────────────────────────────

export interface DevicePushToken {
  token: string;
  platform: 'ios' | 'android';
}

/**
 * Fetch this device's Expo push token. Returns null if:
 *   - The device isn't a real phone (Expo Go on the web, simulator
 *     without push entitlements, etc.).
 *   - The expo-notifications native module fails to initialize.
 *   - Permission wasn't granted (caller should check first).
 *
 * Caller must have already obtained notification permission — we
 * don't prompt here. See use-push-registration.ts for the orchestration.
 */
export async function getDevicePushToken(): Promise<DevicePushToken | null> {
  try {
    // EAS / Expo Go uses the projectId in app.config.ts; explicitly
    // pass it so `expo-notifications` can issue the token even when
    // the manifest is partial.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || undefined;
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: typeof projectId === 'string' && projectId.length > 0 ? projectId : undefined,
    });
    if (!tokenResponse?.data) return null;
    return {
      token: tokenResponse.data,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    };
  } catch {
    // Real phones with permission still occasionally fail here when
    // Apple Push Servers / FCM are unreachable. Caller treats null as
    // "skip registration this boot, try again next launch".
    return null;
  }
}
