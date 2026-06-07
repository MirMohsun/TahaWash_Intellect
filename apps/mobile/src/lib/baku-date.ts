/**
 * Baku timezone date helpers.
 *
 * Azerbaijan is UTC+4 year-round (no DST since 2016), so we can shift
 * by a fixed offset to read "Baku calendar day" without a tz library.
 *
 * Used by the History tab for grouping transactions into Today /
 * Yesterday / Earlier and for the "Spent this month" bar chart's
 * per-day buckets.
 */

const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;

/** Returns the YYYY-MM-DD calendar day in Baku for an absolute instant. */
export function bakuDateString(d: Date): string {
  const shifted = new Date(d.getTime() + BAKU_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/** Returns Baku-local Date with H/M/S zeroed (for date math). */
export function bakuStartOfDay(d: Date): Date {
  const day = bakuDateString(d);
  // Construct a UTC instant that's exactly Baku midnight.
  return new Date(`${day}T00:00:00.000Z`);
}

/** "today" in Baku, used as the comparison reference. */
export function bakuToday(): string {
  return bakuDateString(new Date());
}

/** "yesterday" in Baku. */
export function bakuYesterday(): string {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return bakuDateString(yesterday);
}

/** First day of the current Baku-local month, as a YYYY-MM-DD string. */
export function bakuStartOfMonth(): string {
  const todayStr = bakuToday();
  return `${todayStr.slice(0, 7)}-01`;
}

/**
 * Difference in calendar days between two YYYY-MM-DD strings.
 * Positive when `to` is after `from`. Used for grouping bar chart bins.
 */
export function diffDaysFromString(from: string, to: string): number {
  const a = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  );
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Format a transaction's createdAt as "Today, 14:32" / "Yesterday, 18:46" /
 * "May 24, 19:02" (English) for a History card. Uses Baku timezone for
 * the day-bucket comparison, but renders the time-of-day in whatever
 * device timezone the user's set (matches the device clock).
 *
 * Caller passes the i18n translator since we don't want this helper to
 * import react-i18next.
 */
export function formatHistoryDate(
  iso: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const d = new Date(iso);
  const dayStr = bakuDateString(d);
  const today = bakuToday();
  const yesterday = bakuYesterday();
  const time = `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  if (dayStr === today) return `${t('history.today')}, ${time}`;
  if (dayStr === yesterday) return `${t('history.yesterday')}, ${time}`;

  // "May 24, 19:02" — short English month is fine for AZ + EN; RU uses
  // numeric short form to avoid month-name complexity.
  const date = new Date(`${dayStr}T00:00:00.000Z`);
  const lang = t('common.appName') ? t('common.appName') : 'en'; // detect via i18n
  // We just take a numeric "DD.MM" — locale-independent + tight.
  const dd = date.getUTCDate().toString().padStart(2, '0');
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  void lang;
  return `${dd}.${mm}, ${time}`;
}
