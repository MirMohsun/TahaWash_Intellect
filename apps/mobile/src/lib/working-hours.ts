import i18n from 'i18next';

/**
 * Working-hours rendering helper.
 *
 * Schema (per location.ts in shared-types):
 *   workingHours: { mon: { open, close } | null, tue: ..., ... } | null
 *
 * The design groups consecutive same-hour weekdays into ranges
 * ("Mon – Fri  08:00 – 22:00"). We reconstruct that grouping here so
 * the brand-page Working hours card stays compact regardless of how
 * the tenant configured their week.
 */

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = (typeof DAY_ORDER)[number];

interface DaySlot {
  open: string;
  close: string;
}

interface WorkingHoursJson {
  mon?: DaySlot | null;
  tue?: DaySlot | null;
  wed?: DaySlot | null;
  thu?: DaySlot | null;
  fri?: DaySlot | null;
  sat?: DaySlot | null;
  sun?: DaySlot | null;
}

export interface DisplayHoursRow {
  /** "Mon – Fri" or "Sat" or "Mon, Wed, Fri" — already i18n'd. */
  label: string;
  /** "08:00 – 22:00" or "Closed" (already i18n'd). */
  value: string;
}

/**
 * Convert the raw workingHours JSON into a tight grouped list.
 * is24_7 short-circuits — caller should check that first and skip this.
 */
export function buildDisplayHours(workingHours: unknown, closedLabel: string): DisplayHoursRow[] {
  if (!workingHours || typeof workingHours !== 'object') return [];
  const hours = workingHours as WorkingHoursJson;

  // 1. Build (day, descriptor) pairs where descriptor is either
  //    "open-close" string or "CLOSED" — group on identical descriptors.
  const pairs: Array<{ day: DayKey; descriptor: string }> = DAY_ORDER.map((d) => {
    const slot = hours[d];
    return { day: d, descriptor: slot ? `${slot.open} – ${slot.close}` : 'CLOSED' };
  });

  // 2. Group consecutive days with the same descriptor.
  const groups: Array<{ days: DayKey[]; descriptor: string }> = [];
  for (const pair of pairs) {
    const last = groups[groups.length - 1];
    if (last && last.descriptor === pair.descriptor) {
      last.days.push(pair.day);
    } else {
      groups.push({ days: [pair.day], descriptor: pair.descriptor });
    }
  }

  return groups.map((g) => ({
    label: formatDayRange(g.days),
    value: g.descriptor === 'CLOSED' ? closedLabel : g.descriptor,
  }));
}

function formatDayRange(days: DayKey[]): string {
  if (days.length === 1) return dayShort(days[0]!);
  return `${dayShort(days[0]!)} – ${dayShort(days[days.length - 1]!)}`;
}

function dayShort(day: DayKey): string {
  return i18n.t(`common.days.${day}`);
}
