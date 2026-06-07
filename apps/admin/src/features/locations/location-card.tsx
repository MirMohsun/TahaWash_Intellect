import { Link } from '@tanstack/react-router';
import { Clock, MapPin, Phone, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import type { TenantLocation } from '@/lib/locations-api';

/**
 * Single-location card on the list view.
 *
 * Shows: name + status pill, address, hours summary (or "24/7"), bay count,
 * optional contact phone, and an "Edit" affordance routing to the (future)
 * /locations/:id editor. The status pill is the only visual hint that a
 * location is disabled — otherwise the card layout is uniform so the eye
 * can scan a long list of branches quickly.
 */
export function LocationCard({ location }: { location: TenantLocation }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="py-5 px-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold text-ink-900 truncate">{location.name}</h3>
            <p className="mt-0.5 flex items-start gap-1.5 text-sm text-ink-500">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-ink-400" />
              <span className="truncate">{location.address}</span>
            </p>
          </div>
          <StatusPill status={location.status} />
        </div>

        {/* Hours */}
        <div className="flex items-center gap-1.5 text-sm text-ink-700">
          <Clock className="h-4 w-4 text-ink-400" />
          {location.is24_7 ? (
            <span className="font-semibold">{t('tenantAdmin.locations.alwaysOpen')}</span>
          ) : (
            <span>{summarizeHours(location.workingHours, t)}</span>
          )}
        </div>

        {/* Contact phone */}
        {location.contactPhone && (
          <div className="flex items-center gap-1.5 text-sm text-ink-500">
            <Phone className="h-4 w-4 text-ink-400" />
            <span className="tabular-nums">{location.contactPhone}</span>
          </div>
        )}

        {/* Footer: bays + edit */}
        <div className="flex items-center justify-between pt-2 border-t border-line-soft">
          <p className="text-sm text-ink-700">
            <span className="font-semibold tabular-nums">{location.bayCount}</span>{' '}
            {t('tenantAdmin.locations.bayCount', { count: location.bayCount })}
          </p>
          <Link
            to="/locations/$locationId"
            params={{ locationId: location.id }}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            <Settings className="h-4 w-4" />
            {t('tenantAdmin.locations.edit')}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: 'active' | 'disabled' }) {
  const { t } = useTranslation();
  return (
    <span
      className={`shrink-0 px-2 py-0.5 rounded-pill text-xs font-semibold ${
        status === 'active' ? 'bg-success/10 text-success' : 'bg-line-soft text-ink-500'
      }`}
    >
      {t(`tenantAdmin.locations.status.${status}`)}
    </span>
  );
}

/**
 * Compact hours line for the card. Groups consecutive matching days
 * (Mon-Fri 09:00-22:00 / Sat-Sun closed) instead of listing every day —
 * carwashes tend to have a single weekday window + a weekend window.
 *
 * Falls back to "hours not set" when workingHours is null (likely a
 * just-created location waiting for setup).
 */
function summarizeHours(hours: TenantLocation['workingHours'], t: (k: string) => string): string {
  if (!hours) return t('tenantAdmin.locations.hoursNotSet');

  const days: Array<keyof NonNullable<typeof hours>> = [
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
    'sat',
    'sun',
  ];
  const labels: Record<string, string> = {
    mon: t('tenantAdmin.locations.day.mon'),
    tue: t('tenantAdmin.locations.day.tue'),
    wed: t('tenantAdmin.locations.day.wed'),
    thu: t('tenantAdmin.locations.day.thu'),
    fri: t('tenantAdmin.locations.day.fri'),
    sat: t('tenantAdmin.locations.day.sat'),
    sun: t('tenantAdmin.locations.day.sun'),
  };

  // Walk and group consecutive days with the same window.
  const groups: Array<{ start: string; end: string; window: string }> = [];
  let i = 0;
  while (i < days.length) {
    const day = days[i]!;
    const w = hours[day];
    const window = w ? `${w.open}–${w.close}` : t('tenantAdmin.locations.closed');
    let j = i;
    while (j + 1 < days.length) {
      const next = days[j + 1]!;
      const nw = hours[next];
      const nextWindow = nw ? `${nw.open}–${nw.close}` : t('tenantAdmin.locations.closed');
      if (nextWindow !== window) break;
      j += 1;
    }
    groups.push({
      start: labels[day]!,
      end: labels[days[j]!]!,
      window,
    });
    i = j + 1;
  }

  return groups
    .map((g) => (g.start === g.end ? `${g.start} ${g.window}` : `${g.start}–${g.end} ${g.window}`))
    .join(' · ');
}
