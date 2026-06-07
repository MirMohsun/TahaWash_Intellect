import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

interface LogoProps {
  size?: number;
}

/**
 * Tahawash brand logo — water-drop with wash-arc cut.
 *
 * Gradient was REVISED to the blue palette on 2026-05-27 to align with the
 * brand pivot from aqua-teal to blue (see DESIGN_SYSTEM_LOCKED memory).
 * Original mobile design file used #3DD7E8 → #0894A6; now #4692E3 → #2276D6.
 */
export function Logo({ size = 40 }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <LinearGradient id="tahawash-logo-gradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#4692E3" />
          <Stop offset="100%" stopColor="#2276D6" />
        </LinearGradient>
      </Defs>
      <Path
        d="M20 4c5 6 11 13 11 19a11 11 0 0 1-22 0c0-6 6-13 11-19z"
        fill="url(#tahawash-logo-gradient)"
      />
      <Path
        d="M14 24c2 2 4 3 6 3s4-1 6-3"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
