import Mapbox, { Camera, MapView, MarkerView, PointAnnotation, UserLocation } from '@rnmapbox/maps';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { haversineKm } from '../../hooks/use-user-location';
import { colors } from '../../theme/tokens';
import type { MapPin } from './PlaceholderMap';

type ValidPin = MapPin & { latitude: number; longitude: number };

/**
 * Real Mapbox map for the Wash tab.
 *
 * Matches PlaceholderMap's prop interface exactly so the Wash tab swap
 * is a single import change. Wrapped by Map.tsx which decides between
 * Real and Placeholder based on `EXPO_PUBLIC_MAPBOX_TOKEN` presence.
 *
 * Behaviour:
 *   - Auto-fits the camera to the bounding box of all pins with valid
 *     coordinates on initial render; falls back to Baku centre (40.3796,
 *     49.8485) at zoom 11 when no pins.
 *   - Pins with missing lat/lng are filtered out before placing.
 *   - Each pin uses the tenant's themeColor for fill; default = brand-500.
 *   - Active pin: enlarged + inner brand-color circle (instead of white).
 *   - Tapping a pin fires onPinPress(id).
 *   - User-location blue dot when permission granted (hasUserLocation).
 *   - Recenter button overlay (mirrors the placeholder's design).
 *
 * Native runtime: @rnmapbox/maps requires the native Mapbox SDK to be
 * linked at build time. Will throw "RNMBXMapView not found" at render
 * time if run in Expo Go — the Map wrapper guards against this by only
 * mounting RealMap when EXPO_PUBLIC_MAPBOX_TOKEN is set (i.e. in EAS
 * preview/production builds with the native module compiled in).
 */
const BAKU_CENTER: [number, number] = [49.8485, 40.3796]; // [lng, lat]
const DEFAULT_ZOOM = 11;

// Module-level token install. Safe to call even with undefined — Mapbox
// will simply fail at runtime if a map is rendered without a token, which
// is fine because the wrapper guards this case.
const RUNTIME_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
if (RUNTIME_TOKEN) {
  void Mapbox.setAccessToken(RUNTIME_TOKEN);
}

interface RealMapProps {
  pins: MapPin[];
  activePinId?: string | null;
  hasUserLocation: boolean;
  onPinPress?: (id: string) => void;
  onRecenterPress?: () => void;
}

export function RealMap({
  pins,
  activePinId,
  hasUserLocation,
  onPinPress,
  onRecenterPress,
}: RealMapProps) {
  const cameraRef = useRef<Camera>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  // Pre-filter pins with valid coordinates and ensure stable identity.
  const validPins = useMemo(
    () =>
      pins.filter(
        (p): p is ValidPin =>
          typeof p.latitude === 'number' && typeof p.longitude === 'number',
      ),
    [pins],
  );

  // Group nearby pins into clusters at the current zoom. With 0-1 pins (or
  // pins far apart) every entry is a 'single' → renders identically to the
  // un-clustered map, so this can't regress the current 1-tenant view.
  const clusters = useMemo(() => clusterPins(validPins, zoom), [validPins, zoom]);

  const zoomToCluster = (members: ValidPin[]) => {
    const camera = cameraRef.current;
    if (!camera || members.length === 0) return;
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const m of members) {
      minLng = Math.min(minLng, m.longitude);
      maxLng = Math.max(maxLng, m.longitude);
      minLat = Math.min(minLat, m.latitude);
      maxLat = Math.max(maxLat, m.latitude);
    }
    camera.fitBounds([maxLng, maxLat], [minLng, minLat], [80, 80, 80, 80], 500);
  };

  // Compute camera bounds whenever the pin set changes. Bounds with a
  // small inset feel better than a single fitBounds with zero padding.
  const cameraBounds = useMemo(() => {
    if (validPins.length === 0) return null;
    if (validPins.length === 1) {
      const only = validPins[0]!;
      return { type: 'center' as const, lng: only.longitude, lat: only.latitude };
    }
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const p of validPins) {
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
    }
    return { type: 'bounds' as const, sw: [minLng, minLat], ne: [maxLng, maxLat] };
  }, [validPins]);

  // Apply the computed bounds whenever they change.
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera || !cameraBounds) return;
    if (cameraBounds.type === 'center') {
      camera.setCamera({
        centerCoordinate: [cameraBounds.lng, cameraBounds.lat],
        zoomLevel: 14,
        animationDuration: 600,
      });
    } else {
      camera.fitBounds(cameraBounds.ne, cameraBounds.sw, [60, 60, 60, 60], 600);
    }
  }, [cameraBounds]);

  // Recenter handler removed alongside the on-map recenter button — the
  // camera already auto-fits to pin bounds on mount + whenever pins change,
  // and the standalone droplet-shaped recenter SVG was the icon you
  // circled at the map's bottom edge.
  void onRecenterPress;

  return (
    <View style={{ height: 290, position: 'relative' }}>
      <MapView
        style={{ flex: 1 }}
        styleURL={Mapbox.StyleURL.Street}
        // Mapbox terms require attribution to be visible somewhere — keep
        // the (i) attribution badge but move it to top-right where it
        // doesn't compete with our recenter control / the bottom list.
        // logoEnabled hides the small "mapbox" text mark; attribution
        // covers the legal requirement on its own per Mapbox's policy.
        attributionEnabled={true}
        attributionPosition={{ top: 8, right: 8 }}
        logoEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        onCameraChanged={(e) => {
          // Re-cluster only on a meaningful zoom change (avoids re-render
          // thrash during continuous pan/zoom).
          const z = (e as { properties?: { zoom?: number } })?.properties?.zoom;
          if (typeof z === 'number' && Math.abs(z - zoom) > 0.3) setZoom(z);
        }}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: BAKU_CENTER, zoomLevel: DEFAULT_ZOOM }}
        />

        {hasUserLocation ? (
          <UserLocation visible={true} animated={true} showsUserHeadingIndicator={false} />
        ) : null}

        {clusters.map((c) =>
          c.kind === 'single' ? (
            // MarkerView renders live RN views; PointAnnotation snapshots them
            // to a bitmap on Android, which showed the image markers blank
            // (white) because the PNG hadn't loaded when the snapshot was taken.
            <MarkerView
              key={c.pin.id}
              coordinate={[c.pin.longitude, c.pin.latitude]}
              anchor={{ x: 0.5, y: 1 }}
              allowOverlap
            >
              <Pressable onPress={() => onPinPress?.(c.pin.id)} hitSlop={6}>
                <BrandPin active={c.pin.id === activePinId} />
              </Pressable>
            </MarkerView>
          ) : (
            <PointAnnotation
              key={c.id}
              id={c.id}
              coordinate={[c.lng, c.lat]}
              onSelected={() => zoomToCluster(c.members)}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <ClusterBubble count={c.count} />
            </PointAnnotation>
          ),
        )}
      </MapView>
    </View>
  );
}

/**
 * Branded pin element rendered inside a PointAnnotation. PointAnnotation
 * children are rendered as plain RN views projected at the marker's
 * coordinate, so we just draw an SVG.
 *
 * Sized to match the PlaceholderMap pin (~44x54 with white inner circle).
 * Active pin is enlarged and uses the brand color for the inner circle
 * instead of white, so the selection state reads at a glance.
 */
/** Static brand power-washing marker image (rendered un-clipped; see contentFit). */
const POWER_WASHING = require('../../../assets/power-washing_small.png');

/**
 * Carwash map marker — a white round badge carrying the brand power-washing
 * icon, with a small pointer underneath that anchors it to the coordinate. The
 * image uses contentFit:'contain' with padding so its edges are never clipped.
 * The active marker enlarges and gains a brand-colored ring + pointer.
 */
function BrandPin({ active }: { active: boolean }) {
  const d = active ? 52 : 44; // badge diameter
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: '#FFFFFF',
          borderWidth: active ? 2.5 : 1.5,
          borderColor: active ? colors.brand[500] : 'rgba(0,0,0,0.10)',
          alignItems: 'center',
          justifyContent: 'center',
          // MarkerView renders live views, so a normal shadow is safe (no
          // PointAnnotation snapshot black-box artifact).
          shadowColor: '#14181F',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 5,
        }}
      >
        <Image
          source={POWER_WASHING}
          style={{ width: d * 0.6, height: d * 0.6 }}
          contentFit="contain"
        />
      </View>
      {/* Pointer triangle — its bottom tip sits on the coordinate (anchor y:1). */}
      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          borderLeftWidth: 6,
          borderRightWidth: 6,
          borderTopWidth: 9,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: active ? colors.brand[500] : '#FFFFFF',
        }}
      />
    </View>
  );
}

// ─── clustering ────────────────────────────────────────────────

type Cluster =
  | { kind: 'single'; pin: ValidPin }
  | { kind: 'group'; id: string; lng: number; lat: number; count: number; members: ValidPin[] };

/**
 * Greedy geographic clustering. Groups pins within a zoom-dependent radius
 * (large when zoomed out, ~0 when zoomed in). Singletons render as the normal
 * branded pin, so a single carwash / spread-out pins are visually unchanged.
 */
function clusterPins(pins: ValidPin[], zoom: number): Cluster[] {
  const radiusKm = 6000 / Math.pow(2, zoom); // zoom 11 ≈ 2.9km, 14 ≈ 0.37km, 16 ≈ 0.09km
  const used = new Set<number>();
  const out: Cluster[] = [];
  for (let i = 0; i < pins.length; i += 1) {
    if (used.has(i)) continue;
    const a = pins[i]!;
    const members: ValidPin[] = [a];
    used.add(i);
    for (let j = i + 1; j < pins.length; j += 1) {
      if (used.has(j)) continue;
      const b = pins[j]!;
      if (haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) <= radiusKm) {
        members.push(b);
        used.add(j);
      }
    }
    if (members.length === 1) {
      out.push({ kind: 'single', pin: a });
    } else {
      const lng = members.reduce((s, m) => s + m.longitude, 0) / members.length;
      const lat = members.reduce((s, m) => s + m.latitude, 0) / members.length;
      out.push({
        kind: 'group',
        id: members.map((m) => m.id).join('-'),
        lng,
        lat,
        count: members.length,
        members,
      });
    }
  }
  return out;
}

/** Cluster bubble — brand circle showing the member count. */
function ClusterBubble({ count }: { count: number }) {
  const size = count > 9 ? 46 : 40;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brand[500],
        borderWidth: 3,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{ fontFamily: 'Inter_800ExtraBold', fontSize: count > 9 ? 14 : 15, color: '#FFFFFF' }}
      >
        {count}
      </Text>
    </View>
  );
}
