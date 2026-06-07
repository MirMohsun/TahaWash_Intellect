import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { TenantMark } from '../ui/TenantMark';
import { colors, shadows } from '../../theme/tokens';

/**
 * Placeholder map per the locked design.
 *
 * The hi-fi (Design_Mobile_App/app/screens-b.jsx → ScreenWash) uses a
 * hand-drawn SVG "road network" with carwash pins floating on top.
 * Real Mapbox integration lands in Phase 2.5b once we wire @rnmapbox/maps
 * + EAS dev build. Until then this matches the design exactly so visual
 * QA can proceed without a native build.
 *
 * Pin positions are derived from the carwash's array index — first 4
 * tenants get distinct preset positions; anything beyond 4 stacks at
 * the bottom-right. This is a placeholder behavior; real Mapbox will
 * use actual lat/lng → screen-space projection.
 */

const PIN_POSITIONS: ReadonlyArray<{ top: number; left: number }> = [
  { top: 56, left: 84 },
  { top: 92, left: 236 },
  { top: 158, left: 140 },
  { top: 186, left: 296 },
  // additional fall-throughs stack in the bottom-right corner
  { top: 215, left: 305 },
  { top: 225, left: 325 },
];

/**
 * Unified `MapPin` shape used by both PlaceholderMap (placeholder ignores
 * lat/lng) and RealMap (places markers at the given coordinates). Keeping
 * the shape consistent means wash.tsx + the Map wrapper can swap between
 * them without touching call sites.
 */
export interface MapPin {
  id: string;
  brandName: string;
  /** Latitude (decimal degrees). Used by RealMap; ignored by PlaceholderMap. */
  latitude?: number;
  /** Longitude (decimal degrees). Used by RealMap; ignored by PlaceholderMap. */
  longitude?: number;
  /** Tenant brand color (#RRGGBB). Used by RealMap for marker fill; ignored by PlaceholderMap. */
  themeColor?: string;
}

interface PlaceholderMapProps {
  pins: MapPin[];
  activePinId?: string | null;
  hasUserLocation: boolean;
  onPinPress?: (id: string) => void;
  onRecenterPress?: () => void;
}

export function PlaceholderMap({
  pins,
  activePinId,
  hasUserLocation,
  onPinPress,
  onRecenterPress,
}: PlaceholderMapProps) {
  return (
    <View style={{ height: 290, backgroundColor: '#E8EDEF', position: 'relative' }}>
      <RoadNetwork />

      {/* Pins */}
      {pins.slice(0, PIN_POSITIONS.length).map((pin, idx) => {
        const pos = PIN_POSITIONS[idx]!;
        const active = pin.id === activePinId;
        return (
          <View
            key={pin.id}
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              transform: [{ translateX: -22 }],
            }}
            onTouchEnd={() => onPinPress?.(pin.id)}
          >
            <Pin name={pin.brandName} active={active} />
          </View>
        );
      })}

      {/* User location dot — only when we have a fix */}
      {hasUserLocation ? <UserLocationDot /> : null}

      {/* Recenter button */}
      <View
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.bgElev,
          borderWidth: 1,
          borderColor: colors.line,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadows.card,
        }}
        onTouchEnd={onRecenterPress}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path
            d="M12 22s7-7.5 7-13a7 7 0 0 0-14 0c0 5.5 7 13 7 13z"
            fill="none"
            stroke={colors.brand[600]}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </View>
  );
}

/** Stylized road + park layout — matches MapRoads() in screens-b.jsx. */
function RoadNetwork() {
  return (
    <Svg
      viewBox="0 0 402 290"
      preserveAspectRatio="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      width="100%"
      height="100%"
    >
      {/* Wide white roads (background) */}
      <Path
        d="M0,90 Q120,60 240,110 T402,80"
        stroke="#FFFFFF"
        strokeWidth={14}
        fill="none"
        opacity={0.8}
      />
      <Path
        d="M0,180 Q140,170 280,200 T402,220"
        stroke="#FFFFFF"
        strokeWidth={10}
        fill="none"
        opacity={0.7}
      />
      <Path d="M70,0 Q90,140 60,290" stroke="#FFFFFF" strokeWidth={12} fill="none" opacity={0.75} />
      <Path
        d="M260,0 Q280,140 240,290"
        stroke="#FFFFFF"
        strokeWidth={8}
        fill="none"
        opacity={0.6}
      />
      {/* Thin centerlines */}
      <Path d="M0,90 Q120,60 240,110 T402,80" stroke="#C9D6DC" strokeWidth={1} fill="none" />
      <Path d="M70,0 Q90,140 60,290" stroke="#C9D6DC" strokeWidth={1} fill="none" />
      {/* Park / land blocks */}
      <Rect x={305} y={20} width={80} height={50} rx={8} fill="#D7E7DA" opacity={0.6} />
      <Rect x={20} y={210} width={50} height={60} rx={8} fill="#D7E7DA" opacity={0.6} />
    </Svg>
  );
}

interface PinProps {
  name: string;
  active?: boolean;
}

function Pin({ name, active }: PinProps) {
  const size = active ? 52 : 44;
  const markSize = active ? 36 : 30;
  return (
    <View
      style={{
        width: size,
        height: size * 1.23,
        alignItems: 'center',
      }}
    >
      <Svg width={size} height={size * 1.23} viewBox="0 0 44 54">
        <Path
          d="M22 0C9.85 0 0 9.85 0 22c0 14 18 30 22 32 4-2 22-18 22-32C44 9.85 34.15 0 22 0z"
          fill={active ? colors.brand[500] : '#FFFFFF'}
          stroke={active ? colors.brand[700] : 'rgba(0,0,0,0.12)'}
          strokeWidth={1.5}
        />
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: 6,
          width: markSize,
          height: markSize,
          borderRadius: markSize / 2,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
        }}
      >
        <TenantMark name={name} size={markSize} radius={markSize / 2} />
      </View>
    </View>
  );
}

function UserLocationDot() {
  return (
    <View
      style={{
        position: 'absolute',
        top: 218,
        left: 178,
        // Outer halo via shadow ring; on Android we add an extra View
        // because Android doesn't render `boxShadow` rings the same way.
      }}
    >
      {/* Halo */}
      <View
        style={{
          position: 'absolute',
          top: -8,
          left: -8,
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: 'rgba(42,111,219,0.22)',
        }}
      />
      {/* Dot */}
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: '#2A6FDB',
          borderWidth: 3,
          borderColor: '#FFFFFF',
        }}
      />
    </View>
  );
}
