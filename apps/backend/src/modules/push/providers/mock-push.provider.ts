import { Injectable, Logger } from '@nestjs/common';
import type {
  LocalizedPushPayload,
  PushProvider,
  PushRecipient,
  PushSendResult,
} from '../push.types';

/**
 * Mock push provider — logs delivery to the server console.
 *
 * Use ONLY in development. Lets us iterate on push composition, scheduling,
 * and the fan-out worker without contacting FCM. Logs the localized title
 * each recipient would have received based on their language.
 */
@Injectable()
export class MockPushProvider implements PushProvider {
  private readonly logger = new Logger(MockPushProvider.name);

  async sendBatch(
    recipients: PushRecipient[],
    payload: LocalizedPushPayload,
  ): Promise<PushSendResult> {
    for (const r of recipients) {
      const title = pickByLanguage(r.language, payload.titleAz, payload.titleRu, payload.titleEn);
      const body = pickByLanguage(r.language, payload.bodyAz, payload.bodyRu, payload.bodyEn);
      this.logger.log(
        `🔔 [MOCK PUSH] → customer=${r.customerId} platform=${r.platform} lang=${r.language} | ` +
          `"${title}" — ${body}`,
      );
    }
    // Mock always "succeeds" — surfaces no transport failures.
    return { successes: recipients.length, failures: 0 };
  }
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
