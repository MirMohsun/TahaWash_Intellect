import { Link } from '@tanstack/react-router';
import { LayoutGrid, List, MapPin, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTenantLocations } from '@/hooks/use-tenant-locations';
import { LocationCard } from './location-card';
import { LocationsMap } from './locations-map';

/**
 * Locations list (B3.1).
 *
 * Default view = list (the daily-interaction surface for tenant ops).
 * Map toggle swaps to the placeholder for now; real Mapbox ships
 * alongside the Mapbox token (same deferral as mobile 2.5b).
 *
 * Empty state appears only when zero locations exist — different from the
 * dashboard's Wolt-style "hide-if-empty" because this is the SCREEN whose
 * purpose IS this list, so an empty state with a CTA is the right UX.
 */
type ViewMode = 'list' | 'map';

export function LocationsPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<ViewMode>('list');
  const { data, isLoading, isError, refetch } = useTenantLocations();

  const items = data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
            {t('tenantAdmin.locations.title')}
          </h1>
          <p className="mt-1 text-ink-500">{t('tenantAdmin.locations.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="inline-flex rounded-pill bg-line-soft p-1 text-sm">
            <ToggleBtn
              active={view === 'list'}
              onClick={() => setView('list')}
              icon={<List className="h-4 w-4" />}
            >
              {t('tenantAdmin.locations.viewList')}
            </ToggleBtn>
            <ToggleBtn
              active={view === 'map'}
              onClick={() => setView('map')}
              icon={<LayoutGrid className="h-4 w-4" />}
            >
              {t('tenantAdmin.locations.viewMap')}
            </ToggleBtn>
          </div>

          {/* Add location */}
          <Link to="/locations/new">
            <Button size="md">
              <Plus className="h-4 w-4" />
              {t('tenantAdmin.locations.add')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Error banner */}
      {isError && (
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">{t('tenantAdmin.locations.loadError')}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              {t('tenantAdmin.dashboard.retry')}
            </button>
          </CardContent>
        </Card>
      )}

      {/* Body */}
      {isLoading ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : view === 'list' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((loc) => (
            <LocationCard key={loc.id} location={loc} />
          ))}
        </div>
      ) : (
        <LocationsMap locations={items} />
      )}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill font-semibold transition-colors ${
        active ? 'bg-bg-elev text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: 2 }, (_, i) => (
        <Card key={i}>
          <CardContent className="py-5 px-5 space-y-3">
            <div className="h-5 w-2/3 bg-line-soft rounded" />
            <div className="h-3 w-full bg-line-soft rounded" />
            <div className="h-3 w-1/2 bg-line-soft rounded" />
            <div className="pt-3 border-t border-line-soft flex justify-between">
              <div className="h-3 w-16 bg-line-soft rounded" />
              <div className="h-3 w-12 bg-line-soft rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="py-16 flex flex-col items-center text-center px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 mb-4">
          <MapPin className="h-7 w-7 text-brand-600" />
        </div>
        <h3 className="text-xl font-bold text-ink-900">{t('tenantAdmin.locations.emptyTitle')}</h3>
        <p className="mt-1 text-sm text-ink-500 max-w-md">{t('tenantAdmin.locations.emptyBody')}</p>
        <Link to="/locations/new" className="mt-6">
          <Button size="md">
            <Plus className="h-4 w-4" />
            {t('tenantAdmin.locations.addFirst')}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
