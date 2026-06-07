/**
 * Single source of truth for platform setting keys. Adding a new key
 * here is the whole "schema change" — the `platform_settings` table is
 * key-value, no migration needed.
 *
 * Update + admin UI consumers should reference these constants rather
 * than hardcoded strings so a typo at one site doesn't silently desync.
 */

export const PLATFORM_SETTING_KEYS = [
  // Tahawash branding shown on customer + admin surfaces.
  'tahawash.logoUrl', // URL string
  'tahawash.brandColor', // hex #RRGGBB
  // Support contacts surfaced on the Subscription page + mobile profile.
  'support.whatsappNumber', // +994XXXXXXXXX
  'support.email', // valid email
  'support.hours', // free-text display string
] as const;

export type PlatformSettingKey = (typeof PLATFORM_SETTING_KEYS)[number];

export function isPlatformSettingKey(value: string): value is PlatformSettingKey {
  return (PLATFORM_SETTING_KEYS as readonly string[]).includes(value);
}
