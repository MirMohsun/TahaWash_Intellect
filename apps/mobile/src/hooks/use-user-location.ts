import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

/**
 * Best-effort current location.
 *
 * Reads the existing foreground permission status (granted in Phase 2.3's
 * permissions screen) and tries to fetch coordinates. Does NOT prompt
 * for permission — that's the permissions screen's job.
 *
 *   permission === 'granted'   → fetch + return { lat, lng }
 *   permission ≠ 'granted'     → return null (caller renders un-located UX)
 *   GPS error / timeout        → return null (caller renders un-located UX)
 *
 * No retries — geo failures usually mean the device is in airplane mode
 * or indoors with no fix; we'd rather show the un-located fallback list
 * than spin forever.
 */
export interface UserLocation {
  lat: number;
  lng: number;
}

export type UserLocationState =
  | { status: 'loading' }
  | { status: 'unavailable'; reason: 'permission-denied' | 'no-fix' }
  | { status: 'ready'; location: UserLocation };

export function useUserLocation(): UserLocationState {
  const [state, setState] = useState<UserLocationState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status: permStatus } = await Location.getForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        if (!cancelled) {
          setState({ status: 'unavailable', reason: 'permission-denied' });
        }
        return;
      }

      let haveFix = false;

      // Fast path: a cached last-known fix flips us to 'ready' in
      // milliseconds, so the map + "open now near you" render immediately
      // on cold start instead of waiting seconds for a fresh GPS lock (the
      // reason that section used to appear late / only after a refresh).
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) {
          haveFix = true;
          setState({
            status: 'ready',
            location: { lat: last.coords.latitude, lng: last.coords.longitude },
          });
        }
      } catch {
        // Ignore — fall through to a fresh fix below.
      }

      // Refine to a precise current fix (or get the first fix when there
      // was no cached one). Only downgrade to 'no-fix' if we never got any
      // usable location at all.
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          haveFix = true;
          setState({
            status: 'ready',
            location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
        }
      } catch {
        if (!cancelled && !haveFix) {
          setState({ status: 'unavailable', reason: 'no-fix' });
        }
      }
    })().catch(() => {
      if (!cancelled) {
        setState({ status: 'unavailable', reason: 'no-fix' });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Haversine distance in km between two lat/lng points. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
