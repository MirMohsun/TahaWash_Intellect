/**
 * Promo — super-admin-curated promotional card shown on the Main tab.
 * Text-only push is separate (see push.ts); promos always have images.
 */

export type PromoStatus = 'draft' | 'scheduled' | 'active' | 'expired';

export type PromoCtaTarget =
  | { type: 'none' }
  | { type: 'tenant'; tenantId: string }
  | { type: 'external_url'; url: string };

export interface Promo {
  id: string;
  imageUrl: string;
  title: { az: string; ru: string; en: string };
  body: { az: string; ru: string; en: string };
  cta: {
    text: { az: string; ru: string; en: string };
    target: PromoCtaTarget;
  } | null;
  startAt: string;
  endAt: string;
  status: PromoStatus;
  createdAt: string;
}
