import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema';
import type {
  LocalizedPushPayload,
  PushProvider,
  PushRecipient,
  PushSendResult,
} from '../push.types';

/**
 * Expo push provider — delivers to real devices via Expo's push service.
 *
 * The mobile app mints `ExponentPushToken[...]` tokens
 * (Notifications.getExpoPushTokenAsync), so the natural transport is Expo's
 * Push API. Expo relays each token to FCM (Android) / APNs (iOS) under the
 * hood — which means the Expo PROJECT must have FCM credentials uploaded for
 * Android delivery to actually land. No FCM service-account is needed on the
 * backend; the only optional secret here is EXPO_ACCESS_TOKEN (recommended in
 * prod so nobody else can send on the project's behalf).
 *
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 *
 * Failure semantics:
 *   - A non-2xx HTTP response (whole request rejected) THROWS → BullMQ retries
 *     the job. This is the right call: a transient Expo/network blip shouldn't
 *     silently drop a broadcast.
 *   - Per-message "error" tickets are tallied as failures (not thrown). When a
 *     ticket reports `DeviceNotRegistered`, the recipient's customerId is
 *     returned in `invalidCustomerIds` so the processor can null out the dead
 *     token and stop re-sending to it forever.
 */
@Injectable()
export class ExpoPushProvider implements PushProvider {
  private readonly logger = new Logger(ExpoPushProvider.name);

  /** Expo accepts up to 100 messages per request. */
  private static readonly CHUNK_SIZE = 100;
  private static readonly ENDPOINT = 'https://exp.host/--/api/v2/push/send';

  private readonly accessToken: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    this.accessToken = config.get('EXPO_ACCESS_TOKEN', { infer: true }) || undefined;
  }

  async sendBatch(
    recipients: PushRecipient[],
    payload: LocalizedPushPayload,
  ): Promise<PushSendResult> {
    if (recipients.length === 0) {
      return { successes: 0, failures: 0, invalidCustomerIds: [] };
    }

    let successes = 0;
    let failures = 0;
    const invalidCustomerIds: string[] = [];

    for (let i = 0; i < recipients.length; i += ExpoPushProvider.CHUNK_SIZE) {
      const chunk = recipients.slice(i, i + ExpoPushProvider.CHUNK_SIZE);
      const messages = chunk.map((r) => ({
        to: r.pushToken,
        title: pickByLanguage(r.language, payload.titleAz, payload.titleRu, payload.titleEn),
        body: pickByLanguage(r.language, payload.bodyAz, payload.bodyRu, payload.bodyEn),
        sound: 'default' as const,
        priority: 'high' as const,
        // Must match the channel created client-side in push-token.ts
        // (ensureAndroidChannel). Without it Android may drop the push.
        channelId: 'default',
        ...(payload.data ? { data: payload.data } : {}),
      }));

      const tickets = await this.postChunk(messages);

      // Tickets come back index-aligned with the messages we sent.
      chunk.forEach((recipient, idx) => {
        const ticket = tickets[idx];
        if (ticket && ticket.status === 'ok') {
          successes += 1;
          return;
        }
        failures += 1;
        const errCode = ticket?.details?.error;
        if (errCode === 'DeviceNotRegistered') {
          invalidCustomerIds.push(recipient.customerId);
        }
        this.logger.warn(
          `Expo push not accepted for customer=${recipient.customerId}: ` +
            `${ticket?.message ?? errCode ?? 'no ticket returned'}`,
        );
      });
    }

    this.logger.log(
      `Expo push batch done: accepted=${successes} rejected=${failures} ` +
        `dead-tokens=${invalidCustomerIds.length}`,
    );
    return { successes, failures, invalidCustomerIds };
  }

  /**
   * POST one ≤100-message chunk to Expo. Throws on transport-level failure
   * (non-2xx / unparseable body) so the caller can fail the job for a retry.
   */
  private async postChunk(messages: ExpoPushMessage[]): Promise<ExpoTicket[]> {
    const res = await fetch(ExpoPushProvider.ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Expo push API responded ${res.status}: ${text.slice(0, 500)}`);
    }

    const json = (await res.json().catch(() => null)) as ExpoPushResponse | null;
    if (!json || !Array.isArray(json.data)) {
      const errMsg = json?.errors ? JSON.stringify(json.errors).slice(0, 500) : 'no data array';
      throw new Error(`Expo push API returned an unexpected body: ${errMsg}`);
    }
    return json.data;
  }
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'high';
  channelId: string;
  data?: Record<string, string>;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushResponse {
  data?: ExpoTicket[];
  errors?: unknown;
}

function pickByLanguage<T>(language: string, az: T, ru: T, en: T): T {
  switch (language) {
    case 'az':
      return az;
    case 'ru':
      return ru;
    case 'en':
      return en;
    default:
      return en;
  }
}
