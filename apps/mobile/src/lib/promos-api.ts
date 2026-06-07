import { api } from './api';

/**
 * Active promos for the customer Main tab. Public endpoint, no auth needed.
 * Backend filters to status='active' + within startAt/endAt window.
 */

export interface PublicPromo {
  id: string;
  /** Optional — when null/empty the banner renders as a colored gradient. */
  imageUrl: string | null;
  /** Banner color theme ("blue"|"violet"|"teal"|"amber"); null → color by position. */
  theme: string | null;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  bodyAz: string;
  bodyRu: string;
  bodyEn: string;
  ctaTextAz: string | null;
  ctaTextRu: string | null;
  ctaTextEn: string | null;
  ctaTargetType: 'tenant' | 'external_url' | null;
  ctaTargetValue: string | null;
  startAt: string;
  endAt: string;
}

export async function listActivePromos(): Promise<PublicPromo[]> {
  const res = await api.get<PublicPromo[]>('/public/promos');
  return res.data;
}
