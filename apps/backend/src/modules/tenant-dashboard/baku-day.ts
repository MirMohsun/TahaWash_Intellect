/**
 * Baku-calendar-day helpers used by the dashboard endpoint.
 *
 * Azerbaijan is UTC+4 year-round (no DST since 2016), so we can compute
 * Baku-local calendar days from UTC by adding a fixed offset. This file
 * mirrors `subscription-expiry/subscription-window.logic.ts`'s
 * `bakuCalendarDay()` — extracted here in service-local form so the
 * dashboard service can also compute UTC boundary instants for `WHERE`
 * clauses (not just date strings).
 *
 * No DST + a fixed offset means: "Baku midnight" = "UTC 20:00 the prior
 * day". So to find rows whose `createdAt` lies on a given Baku calendar
 * day, we filter `[bakuStartUtc, bakuStartUtc + 24h)`.
 */

const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;

/** "YYYY-MM-DD" Baku-calendar-day string for an absolute instant. */
export function bakuDateString(d: Date): string {
  return new Date(d.getTime() + BAKU_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant for the start of the Baku calendar day containing `d`. */
export function bakuStartOfDayUtc(d: Date): Date {
  const shifted = new Date(d.getTime() + BAKU_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
      BAKU_OFFSET_MS,
  );
}

/** UTC start of the Baku calendar day `daysAgo` days before `now`. */
export function bakuStartOfDayUtcDaysAgo(now: Date, daysAgo: number): Date {
  return new Date(bakuStartOfDayUtc(now).getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

/** UTC start of the first day of the Baku calendar month containing `d`. */
export function bakuStartOfMonthUtc(d: Date): Date {
  const shifted = new Date(d.getTime() + BAKU_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - BAKU_OFFSET_MS);
}

/**
 * UTC start of the first day of the Baku calendar month that is `monthsAgo`
 * whole months before `now`. `Date.UTC(year, month-N, 1)` handles negative
 * month rollover into prior years correctly.
 */
export function bakuStartOfMonthUtcMonthsAgo(now: Date, monthsAgo: number): Date {
  const shifted = new Date(now.getTime() + BAKU_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() - monthsAgo, 1) - BAKU_OFFSET_MS,
  );
}

/** "YYYY-MM" Baku-calendar-month key for an absolute instant. */
export function bakuMonthKey(d: Date): string {
  return new Date(d.getTime() + BAKU_OFFSET_MS).toISOString().slice(0, 7);
}
