import { PlaceholderMap, type MapPin } from './PlaceholderMap';
import { RealMap } from './RealMap';

/**
 * Map wrapper — picks RealMap when a Mapbox runtime token is available
 * (EAS preview/production builds, native module linked), otherwise falls
 * back to PlaceholderMap (local Expo Go dev, or builds without the token).
 *
 * The decision is made at module load, not per-render, so we don't risk
 * loading @rnmapbox/maps native bindings in Expo Go just to find out we
 * shouldn't have rendered them. (The import itself is JS-side and safe.)
 *
 * Both implementations accept the SAME prop interface, so the Wash tab
 * call site doesn't change when the underlying map provider does.
 */
export type { MapPin };

interface MapProps {
  pins: MapPin[];
  activePinId?: string | null;
  hasUserLocation: boolean;
  onPinPress?: (id: string) => void;
  onRecenterPress?: () => void;
}

const HAS_MAPBOX_TOKEN = Boolean(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);

export function Map(props: MapProps) {
  if (HAS_MAPBOX_TOKEN) {
    return <RealMap {...props} />;
  }
  return <PlaceholderMap {...props} />;
}
