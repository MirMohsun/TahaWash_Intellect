/**
 * Time helpers for Tahawash — always Asia/Baku (UTC+4, no DST). Locked spec.
 */

import { format, parse } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import type { WorkingHours, WorkingHoursDay } from '@tahawash/shared-types';

export const BAKU_TZ = 'Asia/Baku';

/** Format a Date as "27.05.2026, 14:32" in Asia/Baku. */
export function formatDateBaku(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, BAKU_TZ, 'dd.MM.yyyy, HH:mm');
}

/** Format just the time portion "14:32". */
export function formatTimeBaku(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, BAKU_TZ, 'HH:mm');
}

/** Day-of-week key matching the WorkingHours interface keys. */
type DayKey = keyof WorkingHours;

const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Determine whether a location with the given working hours is open RIGHT NOW
 * in Asia/Baku time.
 *
 * Rules:
 * - if 24/7 → always true (caller checks is24_7 flag externally)
 * - if no hours configured for today → closed
 * - else compare current HH:mm to today's open/close window
 *
 * Note: this is a UI helper for the customer app's "Open now" pill. Backend
 * has the authoritative implementation.
 */
export function isOpenNow(hours: WorkingHours | null, now: Date = new Date()): boolean {
  if (!hours) return false;

  const zoned = toZonedTime(now, BAKU_TZ);
  const dayKey = DAY_KEYS[zoned.getDay()];
  if (!dayKey) return false;

  const today: WorkingHoursDay | null = hours[dayKey];
  if (!today) return false;

  const openMinutes = hhMmToMinutes(today.open);
  const closeMinutes = hhMmToMinutes(today.close);
  if (openMinutes === null || closeMinutes === null) return false;

  const nowMinutes = zoned.getHours() * 60 + zoned.getMinutes();

  // Handle overnight (e.g. open 22:00, close 06:00)
  if (closeMinutes < openMinutes) {
    return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
  }
  return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
}

function hhMmToMinutes(hhmm: string): number | null {
  try {
    const parsed = parse(hhmm, 'HH:mm', new Date(2000, 0, 1));
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.getHours() * 60 + parsed.getMinutes();
  } catch {
    return null;
  }
}

/** Re-export `format` for callers who want raw date-fns formatting. */
export { format };
