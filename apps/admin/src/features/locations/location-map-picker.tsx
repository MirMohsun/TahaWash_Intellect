import mapboxgl, { type Map as MapboxMap, type Marker } from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import 'mapbox-gl/dist/mapbox-gl.css';

/**
 * Click-to-set + drag-to-fine-tune map picker for the location form.
 *
 * Behaviour:
 *  - Initial centre: (latitude, longitude) from props (Baku default in the form).
 *  - Click anywhere on the map → moves the pin AND fires onChange.
 *  - Drag the pin to fine-tune → fires onChange on dragend.
 *  - When lat/lng change externally (e.g. user edits the number inputs),
 *    the pin reactively moves to match.
 *  - Defensive fallback when VITE_MAPBOX_TOKEN is empty: returns null so
 *    the form's plain number inputs (above this component) remain usable
 *    on their own.
 */
interface LocationMapPickerProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  disabled?: boolean;
}

const DEFAULT_ZOOM = 14;

export function LocationMapPicker({
  latitude,
  longitude,
  onChange,
  disabled = false,
}: LocationMapPickerProps) {
  const { t } = useTranslation();
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  const tenant = useAuthStore((s) => s.tenant);
  const brandColor = tenant?.themeColor ?? '#0E7AE7';

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  // Latest onChange + disabled flags via ref so the map event listeners
  // (attached once on init) always invoke the latest callback / read the
  // latest disabled state without needing to re-attach.
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  // ── Initialise the map once ────────────────────────────────────
  useEffect(() => {
    if (!token || !containerRef.current) return;
    if (mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [longitude, latitude],
      zoom: DEFAULT_ZOOM,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    // Build the draggable marker.
    const el = buildMarkerElement(brandColor);
    const marker = new mapboxgl.Marker({
      element: el,
      draggable: true,
      anchor: 'bottom',
    })
      .setLngLat([longitude, latitude])
      .addTo(map);

    marker.on('dragend', () => {
      if (disabledRef.current) return;
      const { lng, lat } = marker.getLngLat();
      onChangeRef.current(lat, lng);
    });

    map.on('click', (e) => {
      if (disabledRef.current) return;
      const { lng, lat } = e.lngLat;
      marker.setLngLat([lng, lat]);
      onChangeRef.current(lat, lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // We intentionally omit latitude/longitude from deps — they're used
    // only for the INITIAL centre + marker placement. Subsequent updates
    // sync via the next useEffect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, brandColor]);

  // ── Sync the marker to external lat/lng changes ────────────────
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    const current = marker.getLngLat();
    // Only update if the new position differs (avoids fighting the user mid-drag).
    if (Math.abs(current.lat - latitude) < 1e-6 && Math.abs(current.lng - longitude) < 1e-6) {
      return;
    }
    marker.setLngLat([longitude, latitude]);
    // Pan to keep the pin in view, but don't change the user's zoom level.
    map.panTo([longitude, latitude], { duration: 400 });
  }, [latitude, longitude]);

  if (!token) {
    // No token in this environment — silently render nothing. The form
    // still has the plain lat/lng inputs + "preview on Google Maps" link
    // above us so the page stays usable.
    return null;
  }

  return (
    <div className="rounded-card overflow-hidden border border-line bg-bg-elev">
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: 320 }}
        aria-label={t('tenantAdmin.locations.mapPickerAria')}
      />
      <div className="px-3 py-2 text-xs text-ink-500 border-t border-line">
        {t('tenantAdmin.locations.mapPickerHint')}
      </div>
    </div>
  );
}

function buildMarkerElement(brandColor: string): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.style.width = '32px';
  wrap.style.height = '40px';
  wrap.style.cursor = 'grab';
  wrap.innerHTML = `
    <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 0C7.16 0 0 7.16 0 16c0 10.18 13.09 21.82 16 23.27C18.91 37.82 32 26.18 32 16 32 7.16 24.84 0 16 0z"
        fill="${brandColor}"
        stroke="rgba(0,0,0,0.18)"
        stroke-width="1"
      />
      <circle cx="16" cy="15" r="6" fill="white" />
    </svg>
  `;
  return wrap;
}
