/**
 * Push notification provider abstraction.
 *
 * Mirrors the SMS provider pattern: concrete implementations sit in
 * src/modules/push/providers/, the module factory picks one based on
 * PUSH_PROVIDER env var, and callers inject PushService (not the raw
 * provider) so the implementation can swap without touching callsites.
 */

import type { CustomerLanguage } from '@prisma/client';

/** Per-recipient delivery target. */
export interface PushRecipient {
  customerId: string;
  pushToken: string;
  language: CustomerLanguage;
  platform: 'ios' | 'android';
}

/**
 * A localized push payload. Each provider picks the right
 * language-specific copy when delivering — keeps callers from having to
 * pre-localize a giant batch on the producer side.
 */
export interface LocalizedPushPayload {
  titleAz: string;
  titleRu: string;
  titleEn: string;
  bodyAz: string;
  bodyRu: string;
  bodyEn: string;
  /** Optional deep-link target (e.g. tenant id, promo id). Carried as a string field. */
  data?: Record<string, string>;
}

/** Result of a fan-out call. */
export interface PushSendResult {
  /** Per-recipient outcome. Implementations should attempt all and report individually. */
  successes: number;
  failures: number;
  /**
   * customerIds whose device token the provider reported as permanently
   * invalid (e.g. Expo `DeviceNotRegistered`). The caller should null these
   * tokens so we stop re-sending to dead devices. Optional — providers that
   * can't detect this (e.g. mock) simply omit it.
   */
  invalidCustomerIds?: string[];
}

/** Generic interface implemented by every push provider. */
export interface PushProvider {
  /**
   * Deliver one localized payload to many recipients in one call.
   * Implementations decide chunking (e.g. FCM caps at 500/req).
   */
  sendBatch(recipients: PushRecipient[], payload: LocalizedPushPayload): Promise<PushSendResult>;
}

/** DI token used to inject the active push provider. */
export const PUSH_PROVIDER_TOKEN = Symbol('PUSH_PROVIDER');
