import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ColorValue } from 'react-native';

/**
 * Tahawash icon set — Lucide-style line icons with 1.75px default stroke.
 *
 * Ported one-to-one from the locked design file (Design_Mobile_App/app/common.jsx).
 * Use a string `name` rather than per-icon components so we get one
 * import-site for icons everywhere and can grep `<Icon name="qr"` to
 * find usages.
 *
 * Active tab convention: stroke = 2.1 (vs 1.75 default); see
 * project_yubox_DESIGN_SYSTEM_LOCKED.md.
 */

export type IconName =
  | 'back'
  | 'close'
  | 'home'
  | 'map'
  | 'qr'
  | 'history'
  | 'user'
  | 'search'
  | 'filter'
  | 'plus'
  | 'minus'
  | 'heart'
  | 'heartSolid'
  | 'chevron'
  | 'chevronDown'
  | 'mapPin'
  | 'clock'
  | 'directions'
  | 'phone'
  | 'whatsapp'
  | 'bell'
  | 'globe'
  | 'doc'
  | 'trash'
  | 'card'
  | 'flash'
  | 'zap'
  | 'check'
  | 'arrowRight'
  | 'drop'
  | 'spray'
  | 'wax'
  | 'vacuum'
  | 'brush'
  | 'alert'
  | 'star';

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  color?: ColorValue;
  fill?: ColorValue | 'none';
}

export function Icon({
  name,
  size = 22,
  stroke = 1.75,
  color = '#14181F',
  fill = 'none',
}: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: fill === 'none' ? 'none' : (fill as string),
    stroke: color as string,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'back':
      return (
        <Svg {...common}>
          <Path d="M15 18l-6-6 6-6" />
        </Svg>
      );
    case 'close':
      return (
        <Svg {...common}>
          <Path d="M18 6L6 18" />
          <Path d="M6 6l12 12" />
        </Svg>
      );
    case 'home':
      return (
        <Svg {...common}>
          <Path d="M3 10.6 12 3l9 7.6" />
          <Path d="M5.5 9.6V20a1 1 0 0 0 1 1H17.5a1 1 0 0 0 1-1V9.6" />
          <Path d="M9.5 21v-5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V21" />
        </Svg>
      );
    case 'map':
      return (
        <Svg {...common}>
          <Path d="M9 4 3.6 6.1A1 1 0 0 0 3 7v12.1a.6.6 0 0 0 .82.56L9 18l6 3 5.4-2.1A1 1 0 0 0 21 18V5.9a.6.6 0 0 0-.82-.56L15 6 9 4Z" />
          <Path d="M9 4v14" />
          <Path d="M15 6v15" />
        </Svg>
      );
    case 'qr':
      return (
        <Svg {...common}>
          <Rect x="3" y="3" width="7" height="7" rx="1" />
          <Rect x="14" y="3" width="7" height="7" rx="1" />
          <Rect x="3" y="14" width="7" height="7" rx="1" />
          <Path d="M14 14h3v3h-3z" />
          <Path d="M20 14v3" />
          <Path d="M14 20h3" />
          <Path d="M20 20v.01" />
        </Svg>
      );
    case 'clock':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 7v5l3 2" />
        </Svg>
      );
    case 'history':
      return (
        <Svg {...common}>
          <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <Path d="M3 3v5h5" />
          <Path d="M12 7.5v4.5l4 2" />
        </Svg>
      );
    case 'user':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="8" r="3.6" />
          <Path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
        </Svg>
      );
    case 'search':
      return (
        <Svg {...common}>
          <Circle cx="11" cy="11" r="7" />
          <Path d="M20 20l-3.5-3.5" />
        </Svg>
      );
    case 'filter':
      return (
        <Svg {...common}>
          <Path d="M4 5h16" />
          <Path d="M7 12h10" />
          <Path d="M10 19h4" />
        </Svg>
      );
    case 'plus':
      return (
        <Svg {...common} strokeWidth={2.4}>
          <Path d="M12 5v14" />
          <Path d="M5 12h14" />
        </Svg>
      );
    case 'minus':
      return (
        <Svg {...common} strokeWidth={2.4}>
          <Path d="M5 12h14" />
        </Svg>
      );
    case 'heart':
      return (
        <Svg {...common}>
          <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.49 4.04 3 5.5l7 7Z" />
        </Svg>
      );
    case 'heartSolid':
      return (
        <Svg {...common} fill={color as string} stroke={color as string} strokeWidth={1}>
          <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.49 4.04 3 5.5l7 7Z" />
        </Svg>
      );
    case 'chevron':
      return (
        <Svg {...common}>
          <Path d="M9 6l6 6-6 6" />
        </Svg>
      );
    case 'chevronDown':
      return (
        <Svg {...common}>
          <Path d="M6 9l6 6 6-6" />
        </Svg>
      );
    case 'mapPin':
      return (
        <Svg {...common}>
          <Path d="M12 22s7-7.5 7-13a7 7 0 0 0-14 0c0 5.5 7 13 7 13z" />
          <Circle cx="12" cy="9" r="2.5" />
        </Svg>
      );
    case 'directions':
      return (
        <Svg {...common}>
          <Path d="M12 2L22 12 12 22 2 12z" />
          <Path d="M9 14v-3a2 2 0 0 1 2-2h4" />
          <Path d="M13 11l2-2-2-2" />
        </Svg>
      );
    case 'phone':
      return (
        <Svg {...common}>
          <Path d="M5 4h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
        </Svg>
      );
    case 'whatsapp':
      return (
        <Svg {...common}>
          <Path d="M3 21l1.5-4.5a8 8 0 1 1 3 3L3 21z" />
          <Path d="M8.5 9.5c.5 2 2 4 4 4.5l1.5-1 2 1c.5 1-.5 2-2 2-2.5 0-6-3-6-5.5 0-1.5 1-2.5 2-2l1 2-.5 1z" />
        </Svg>
      );
    case 'bell':
      return (
        <Svg {...common}>
          <Path d="M6 17V11a6 6 0 1 1 12 0v6" />
          <Path d="M4 17h16" />
          <Path d="M10 21a2 2 0 0 0 4 0" />
        </Svg>
      );
    case 'globe':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M3 12h18" />
          <Path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </Svg>
      );
    case 'doc':
      return (
        <Svg {...common}>
          <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <Path d="M14 3v5h5" />
        </Svg>
      );
    case 'trash':
      return (
        <Svg {...common}>
          <Path d="M4 7h16" />
          <Path d="M10 11v6M14 11v6" />
          <Path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
          <Path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </Svg>
      );
    case 'card':
      return (
        <Svg {...common}>
          <Rect x="3" y="6" width="18" height="13" rx="2" />
          <Path d="M3 11h18" />
          <Path d="M7 16h3" />
        </Svg>
      );
    case 'flash':
      return (
        <Svg {...common}>
          <Path d="M13 2L4 13h7l-1 9 9-11h-7z" />
        </Svg>
      );
    case 'zap':
      return (
        <Svg {...common} fill={color as string} stroke="none">
          <Path d="M13 2L3 14h7l-1 8 11-13h-7z" />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...common} strokeWidth={2.4}>
          <Path d="M5 12l5 5L20 7" />
        </Svg>
      );
    case 'arrowRight':
      return (
        <Svg {...common}>
          <Path d="M5 12h14" />
          <Path d="M13 5l7 7-7 7" />
        </Svg>
      );
    case 'drop':
      return (
        <Svg {...common}>
          <Path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z" />
        </Svg>
      );
    case 'spray':
      return (
        <Svg {...common}>
          <Rect x="8" y="9" width="6" height="11" rx="1" />
          <Path d="M9 9V6h4v3" />
          <Path d="M16 6h3M16 4h3M16 8h3" />
        </Svg>
      );
    case 'wax':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="13" r="6" />
          <Path d="M9 10c1-2 4-2 5 0" />
        </Svg>
      );
    case 'vacuum':
      return (
        <Svg {...common}>
          <Path d="M4 20h6l2-8h6" />
          <Path d="M16 12V6a2 2 0 0 1 2-2h2" />
          <Circle cx="7" cy="20" r="2" />
        </Svg>
      );
    case 'brush':
      return (
        <Svg {...common}>
          <Path d="M14 4l6 6-8 8-6-6z" />
          <Path d="M3 21l4-3" />
        </Svg>
      );
    case 'alert':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 8v4" />
          <Path d="M12 16v.01" />
        </Svg>
      );
    case 'star':
      return (
        <Svg {...common} fill={color as string} stroke="none">
          <Path d="M12 3l2.7 5.5 6 .9-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.9z" />
        </Svg>
      );
  }
}
