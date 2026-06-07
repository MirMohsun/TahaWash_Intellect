import { useNavigate } from '@tanstack/react-router';
import mapboxgl, { type Map as MapboxMap, type Marker } from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import type { TenantLocation } from '@/lib/locations-api';
import { MapPlaceholder } from './map-placeholder';
import 'mapbox-gl/dist/mapbox-gl.css';

/**
 * Real Mapbox-backed map view for the Locations list (B3.1).
 *
 * Renders all tenant locations as branded pins on a Mapbox street map.
 * Auto-fits the camera to the bounding box of all pins; falls back to
 * Baku center when only one location exists.
 *
 * Behaviour:
 *  - Pin tap → Mapbox popup with location name + a deep link to the edit form
 *  - Reactive: re-syncs markers when the locations list changes (add / delete / edit)
 *  - Defensive: if VITE_MAPBOX_TOKEN is empty (e.g. local dev without an account),
 *    falls back to <MapPlaceholder> instead of throwing — keeps the screen usable
 *  - Robust to React 18 strict-mode double-mounting: tracks the map instance via
 *    useRef and tears it down in the cleanup function.
 */
const BAKU_CENTER: [number, number] = [49.8485, 40.3796]; // [lng, lat] — Mapbox order
const DEFAULT_ZOOM = 11;

export function LocationsMap({ locations }: { locations: TenantLocation[] }) {
  const { t } = useTranslation();
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  const tenant = useAuthStore((s) => s.tenant);
  const brandColor = tenant?.themeColor ?? '#0E7AE7';

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // ── Initialise the map once (or after the token becomes available) ──
  useEffect(() => {
    if (!token || !containerRef.current) return;
    if (mapRef.current) return; // already initialised

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: BAKU_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        showUserHeading: false,
      }),
      'top-right',
    );

    map.on('load', () => setMapReady(true));
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [token]);

  // ── Re-sync markers whenever the locations list changes ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Wipe previous markers.
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (locations.length === 0) return;

    // Build a new marker per location.
    locations.forEach((loc) => {
      const el = buildMarkerElement(brandColor);
      const popup = new mapboxgl.Popup({ offset: 24, closeButton: false }).setHTML(
        buildPopupHtml(loc, t),
      );
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([loc.longitude, loc.latitude])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    });

    // Camera-fit. If only one location, centre on it; otherwise bound to all.
    if (locations.length === 1) {
      const only = locations[0]!;
      map.flyTo({
        center: [only.longitude, only.latitude],
        zoom: 14,
        essential: true,
      });
    } else {
      const bounds = new mapboxgl.LngLatBounds();
      locations.forEach((loc) => bounds.extend([loc.longitude, loc.latitude]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 600 });
    }
  }, [locations, mapReady, brandColor, t]);

  // ── No token configured → graceful fallback ──────────────────────────
  if (!token) {
    return <MapPlaceholder locations={locations} />;
  }

  return (
    <div className="rounded-card overflow-hidden border border-line bg-bg-elev">
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: 'min(60vh, 560px)' }}
        aria-label={t('tenantAdmin.locations.mapAria')}
      />
      {locations.length === 0 && (
        <div className="p-4 text-center text-sm text-ink-500">
          {t('tenantAdmin.locations.mapEmptyHint')}
        </div>
      )}
      {/* Mapbox popups inject raw HTML outside React. We intercept clicks
          on the popup's "Edit" link via a global delegate that routes to
          TanStack Router. */}
      <PopupNavigation />
    </div>
  );
}

/**
 * Effect-only component: delegates clicks on Mapbox popup "Edit" anchors
 * to TanStack Router's `useNavigate`. The popups inject anchors outside
 * React, so a normal <Link> won't work.
 */
function PopupNavigation() {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const link = target.closest('a[data-location-edit]') as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute('href');
      if (href && href.startsWith('/locations/')) {
        e.preventDefault();
        void navigate({ to: href });
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [navigate]);
  return null;
}

/**
 * Build a Mapbox marker DOM element styled to match the tenant brand.
 * Plain DOM (not React) because Mapbox manages these nodes outside React.
 */
function buildMarkerElement(brandColor: string): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.style.width = '32px';
  wrap.style.height = '40px';
  wrap.style.cursor = 'pointer';
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

/**
 * Build the inner HTML of the marker popup. Returns a small card with the
 * location name + address + a link to the edit form.
 */
function buildPopupHtml(loc: TenantLocation, t: (key: string) => string): string {
  const safeName = escapeHtml(loc.name);
  const safeAddress = escapeHtml(loc.address);
  const editLabel = escapeHtml(t('tenantAdmin.locations.mapEdit'));
  return `
    <div style="font-family: Inter, system-ui, sans-serif; min-width: 200px;">
      <div style="font-weight: 700; color: #0F172A; margin-bottom: 4px;">${safeName}</div>
      <div style="font-size: 12px; color: #64748B; margin-bottom: 8px;">${safeAddress}</div>
      <a href="/locations/${loc.id}" data-location-edit
         style="font-size: 13px; font-weight: 600; color: #0E7AE7; text-decoration: none;">
        ${editLabel} →
      </a>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
