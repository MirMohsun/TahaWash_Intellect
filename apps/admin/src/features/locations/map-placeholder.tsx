import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TenantLocation } from '@/lib/locations-api';

/**
 * Map-view placeholder.
 *
 * The locked stack uses `mapbox-gl` for the admin map. We're not installing
 * it yet because:
 *   - it needs `VITE_MAPBOX_TOKEN` to render anything (user signed up for
 *     Mapbox in Phase 0.1; not yet provisioned for local dev)
 *   - bundle cost (~200 KB gz) without a useful render until the token's there
 *   - the list view is the primary daily-interaction surface; map is a
 *     "where are my branches" overview that can ride into a follow-up
 *
 * Once the token is wired:
 *   1. `pnpm --filter @tahawash/admin add mapbox-gl @types/mapbox-gl`
 *   2. Replace this component with a real `<Map />` (or import 'mapbox-gl/dist/mapbox-gl.css')
 *   3. Plot each location with a custom marker (use the tenant.themeColor)
 *
 * Until then we render a Tahawash-styled card listing locations grouped by
 * lat/lng-rounded clusters — gives the admin a visual of "where are we"
 * without needing real tiles.
 */
export function MapPlaceholder({ locations }: { locations: TenantLocation[] }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-card border border-line bg-gradient-to-br from-brand-50 to-bg-elev p-8 flex flex-col items-center justify-center min-h-[420px] text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/10 mb-4">
        <MapPin className="h-8 w-8 text-brand-600" />
      </div>
      <h3 className="text-lg font-bold text-ink-900">
        {t('tenantAdmin.locations.mapPlaceholderTitle')}
      </h3>
      <p className="mt-1 text-sm text-ink-500 max-w-md">
        {t('tenantAdmin.locations.mapPlaceholderBody', { count: locations.length })}
      </p>

      {locations.length > 0 && (
        <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full">
          {locations.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-2 px-3 py-2 rounded-card-sm bg-bg-elev border border-line text-left text-sm"
            >
              <MapPin className="h-4 w-4 text-brand-500 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-ink-900 truncate">{l.name}</p>
                <p className="text-xs text-ink-500 tabular-nums">
                  {l.latitude.toFixed(4)}, {l.longitude.toFixed(4)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
