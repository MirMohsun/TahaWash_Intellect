import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { updateMe } from '../lib/customers-api';
import { ensureAndroidChannel, getDevicePushToken } from '../lib/push-token';
import { useMe } from './use-me';

/**
 * Boot-time push registration + tap handlers.
 *
 * Lifecycle:
 *   1. Mount inside the authed shell (app/(tabs)/_layout.tsx) — only
 *      runs once the customer is signed in.
 *   2. Read current permission (don't prompt — the permissions screen
 *      in Phase 2.3 owns that interaction).
 *   3. If granted AND we don't yet have a server-side token (or
 *      the device's current token differs from what's on file),
 *      register via PATCH /me {pushToken, pushPlatform}.
 *   4. Mount a tap-response listener that routes deep links from
 *      notification data:
 *         { type: 'tenant',      tenantId }      → /tenant/:id
 *         { type: 'transaction', transactionId } → /transaction/:id
 *         (anything else)                        → /
 *
 * Fail-open philosophy: every failure mode just no-ops. Push is a
 * best-effort enhancement; we never block the user on a failed
 * registration.
 */
export function usePushRegistration(): void {
  const meQuery = useMe();
  const customer = meQuery.data;

  useEffect(() => {
    if (!customer) return;

    let cancelled = false;

    (async () => {
      // Ensure the Android channel exists before the first inbound push.
      await ensureAndroidChannel();

      const perm = await Notifications.getPermissionsAsync();
      const granted = (perm as unknown as { status?: string }).status === 'granted';
      if (!granted) {
        // User hasn't agreed — nothing to do. Phase 2.3 permissions
        // screen, or a settings-deeplink, owns asking.
        return;
      }

      const device = await getDevicePushToken();
      if (cancelled || !device) return;

      // Already up-to-date? skip.
      if (customer.pushToken === device.token && customer.pushPlatform === device.platform) {
        return;
      }

      try {
        await updateMe({
          pushToken: device.token,
          pushPlatform: device.platform,
        });
      } catch {
        // Network hiccup or 401 — token registration retries next launch.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customer]);

  // Tap → deep-link router. Subscribe once per mount; unsubscribe on
  // unmount so we don't double-fire across re-renders.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | {
            type?: string;
            tenantId?: string;
            transactionId?: string;
            qrShortId?: string;
          }
        | undefined;
      if (!data) {
        router.push('/');
        return;
      }
      switch (data.type) {
        case 'tenant':
          if (data.tenantId) {
            router.push(`/tenant/${data.tenantId}`);
            return;
          }
          break;
        case 'transaction':
          if (data.transactionId) {
            router.push(`/transaction/${data.transactionId}`);
            return;
          }
          break;
        case 'charge':
          if (data.qrShortId) {
            router.push(`/charge/${data.qrShortId}`);
            return;
          }
          break;
      }
      router.push('/');
    });

    return () => {
      sub.remove();
    };
  }, []);
}
