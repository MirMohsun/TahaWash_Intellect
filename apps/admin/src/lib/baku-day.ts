/**
 * Baku-calendar-day helpers for admin display.
 *
 * UTC+4, no DST since 2016. Same approach as backend:
 *   start of Baku day Y/M/D = UTC of "Y/M/D 00:00" minus 4h
 *
 * Used by the dashboard for tagging "today" vs "yesterday" and for
 * computing days-until-subscription-end.
 */
const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;

export function bakuDateString(d: Date): string {
  return new Date(d.getTime() + BAKU_OFFSET_MS).toISOString().slice(0, 10);
}

/** Whole-days "to - from" assuming both are Baku-day-strings ("YYYY-MM-DD"). */
export function daysBetweenBakuDays(from: string, to: string): number {
  const a = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  );
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Days from `now` (Baku) to a future ISO instant. Negative if already past.
 * Used by the subscription banner — at T-7 / T-1 / T-0 / T+7 we surface
 * different copy.
 */
export function daysUntilBaku(toIso: string, now: Date): number {
  return daysBetweenBakuDays(bakuDateString(now), bakuDateString(new Date(toIso)));
}

/** "DD.MM" — short label for the 7-day chart x-axis. */
export function shortDayLabel(yyyymmdd: string): string {
  return `${yyyymmdd.slice(8, 10)}.${yyyymmdd.slice(5, 7)}`;
}

/** "Today" / "Yesterday" / "DD.MM HH:MM" for the activity feed. */
export function formatActivityTime(iso: string, t: (k: string) => string, now: Date): string {
  const dt = new Date(iso);
  const day = bakuDateString(dt);
  const today = bakuDateString(now);
  const diff = daysBetweenBakuDays(day, today);

  const hhmm = `${pad(getBakuHours(dt))}:${pad(getBakuMinutes(dt))}`;
  if (diff === 0) return `${t('tenantAdmin.dashboard.activityToday')}, ${hhmm}`;
  if (diff === 1) return `${t('tenantAdmin.dashboard.activityYesterday')}, ${hhmm}`;
  return `${day.slice(8, 10)}.${day.slice(5, 7)} ${hhmm}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function getBakuHours(d: Date): number {
  return new Date(d.getTime() + BAKU_OFFSET_MS).getUTCHours();
}

function getBakuMinutes(d: Date): number {
  return new Date(d.getTime() + BAKU_OFFSET_MS).getUTCMinutes();
}
