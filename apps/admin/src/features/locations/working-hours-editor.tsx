import { useTranslation } from 'react-i18next';
import type { WorkingHours, WorkingHoursWindow } from '@/lib/locations-api';

/**
 * Per-day open/close editor.
 *
 * Layout: 7 rows. Each row has a "Closed" checkbox + open + close time
 * inputs side-by-side. The closed checkbox replaces the window with `null`
 * which matches the backend's "this day is closed all day" representation.
 *
 * Default-fill behavior: if the admin toggles a closed day back to open
 * we hand them sensible defaults (09:00–22:00) so they don't start with
 * 00:00–00:00 which would otherwise pass HH:mm validation but be a bug.
 */
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type Day = (typeof DAYS)[number];

const DEFAULT_WINDOW: WorkingHoursWindow = { open: '09:00', close: '22:00' };

export function WorkingHoursEditor({
  value,
  onChange,
  disabled,
}: {
  value: WorkingHours;
  onChange: (next: WorkingHours) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  const setDay = (day: Day, next: WorkingHoursWindow | null) => {
    onChange({ ...value, [day]: next });
  };

  return (
    <div className="space-y-2">
      {DAYS.map((day) => {
        const window = value[day];
        const isClosed = window === null;
        return (
          <div
            key={day}
            className="grid grid-cols-[88px_1fr_auto_auto] items-center gap-3 py-2 border-b border-line-soft last:border-0"
          >
            <span className="text-sm font-semibold text-ink-900">
              {t(`tenantAdmin.locations.day.${day}`)}
            </span>

            {isClosed ? (
              <span className="text-sm text-ink-500 italic">
                {t('tenantAdmin.locations.closed')}
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <TimeInput
                  value={window.open}
                  onChange={(v) => setDay(day, { open: v, close: window.close })}
                  disabled={disabled}
                  ariaLabel={t('tenantAdmin.locations.openLabel')}
                />
                <span className="text-ink-400">—</span>
                <TimeInput
                  value={window.close}
                  onChange={(v) => setDay(day, { open: window.open, close: v })}
                  disabled={disabled}
                  ariaLabel={t('tenantAdmin.locations.closeLabel')}
                />
              </div>
            )}

            <label className="text-xs text-ink-500 flex items-center gap-1.5 cursor-pointer select-none justify-self-end col-span-2">
              <input
                type="checkbox"
                checked={isClosed}
                disabled={disabled}
                onChange={(e) => setDay(day, e.target.checked ? null : DEFAULT_WINDOW)}
                className="h-4 w-4 rounded border-line"
              />
              {t('tenantAdmin.locations.closedThisDay')}
            </label>
          </div>
        );
      })}
    </div>
  );
}

function TimeInput({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      className="h-9 px-2 rounded-card-sm border border-line bg-bg-elev text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
    />
  );
}

/** Default starter hours for a new location (Mon–Fri 9–22, Sat–Sun 10–20). */
export function defaultWorkingHours(): WorkingHours {
  return {
    mon: { open: '09:00', close: '22:00' },
    tue: { open: '09:00', close: '22:00' },
    wed: { open: '09:00', close: '22:00' },
    thu: { open: '09:00', close: '22:00' },
    fri: { open: '09:00', close: '22:00' },
    sat: { open: '10:00', close: '20:00' },
    sun: { open: '10:00', close: '20:00' },
  };
}
