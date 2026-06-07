import { Inject, Injectable } from '@nestjs/common';
import {
  PUSH_PROVIDER_TOKEN,
  type LocalizedPushPayload,
  type PushProvider,
  type PushRecipient,
  type PushSendResult,
} from './push.types';

/**
 * Thin facade over whichever PushProvider is wired (mock / FCM / etc.).
 *
 * Callers — the BullMQ delivery worker, ad-hoc system notifications —
 * depend on this service rather than a concrete provider so the
 * implementation can swap based on env without touching business logic.
 */
@Injectable()
export class PushService {
  constructor(@Inject(PUSH_PROVIDER_TOKEN) private readonly provider: PushProvider) {}

  async sendBatch(
    recipients: PushRecipient[],
    payload: LocalizedPushPayload,
  ): Promise<PushSendResult> {
    if (recipients.length === 0) return { successes: 0, failures: 0 };
    return this.provider.sendBatch(recipients, payload);
  }
}
