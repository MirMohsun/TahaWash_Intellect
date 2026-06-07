/**
 * Pure subscription-expiry window classification.
 *
 * No I/O, no DB, no timezone library. All tenants operate in Asia/Baku
 * which is UTC+4 year-round (Azerbaijan does NOT observe DST since 2016),
 * so we can compute Baku calendar days by adding a fixed offset.
 *
 * Spec-locked notice windows (project_yubox_round4_facts):
 *   T-7  → "subscription expiring in a week"
 *   T-1  → "subscription expiring tomorrow"
 *   T-0  → "subscription expires today"
 *   T+7  → grace period over → auto-suspend the tenant
 */

export type SubscriptionWindow = 't_minus_7' | 't_minus_1' | 't_zero' | 't_plus_7';

/**
 * Returns the matching notice window, or `null` if `subscriptionEnd` is
 * not on one of the four boundary days relative to `now` (in Baku).
 *
 * Day comparison is done on calendar day boundaries — running the cron at
 * 00:05 vs 03:30 Baku time yields the same classification.
 */
export function classifySubscriptionWindow(
  subscriptionEnd: Date | null,
  now: Date,
): SubscriptionWindow | null {
  if (!subscriptionEnd) return null;
  const today = bakuCalendarDay(now);
  const end = bakuCalendarDay(subscriptionEnd);
  const daysUntilEnd = diffDays(today, end);
  switch (daysUntilEnd) {
    case 7:
      return 't_minus_7';
    case 1:
      return 't_minus_1';
    case 0:
      return 't_zero';
    case -7:
      return 't_plus_7';
    default:
      return null;
  }
}

/**
 * Convert an absolute instant to a "YYYY-MM-DD" calendar day string in
 * Baku (UTC+4, no DST). Shifting by +4h and slicing the ISO date portion
 * gives us the Baku-local date regardless of the host timezone.
 */
export function bakuCalendarDay(d: Date): string {
  const shifted = new Date(d.getTime() + 4 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/** Integer day difference `to - from` where both are "YYYY-MM-DD". */
function diffDays(from: string, to: string): number {
  const a = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  );
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}
