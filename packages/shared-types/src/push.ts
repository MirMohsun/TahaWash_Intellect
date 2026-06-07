/**
 * Push — bulk text-only push notifications sent by super-admin.
 * No images (locked spec round 5). No throttling.
 */

export type PushTarget =
  | { type: 'all' }
  | { type: 'city'; cities: string[] }
  | { type: 'language'; languages: Array<'az' | 'ru' | 'en'> };

export interface PushNotification {
  id: string;
  title: { az: string; ru: string; en: string };
  body: { az: string; ru: string; en: string };
  target: PushTarget;
  scheduledFor: string | null;
  sentAt: string | null;
  recipientsCount: number;
  deliveredCount: number;
  createdAt: string;
}
