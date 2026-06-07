import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from '../../theme/tokens';

/**
 * Slide 1 — "Find your carwash"
 *
 * Stylised map of a neighbourhood with curved roads, scattered carwash
 * pins, and a coral "you are here" dot. Visually echoes the Wash-tab
 * PlaceholderMap so users see continuity with the real screen once
 * they land in the app.
 *
 * Composition:
 *   - Soft brand-tinted square background card (radius 32)
 *   - Two flowing white roads (CSS-style curves) for depth
 *   - One large active pin (brand-500) with brand-shadow halo
 *   - Two smaller passive pins (white with brand stroke)
 *   - Coral "you are here" dot with pulse-ring
 *   - Two parks (success/green tint blocks) for visual texture
 *
 * 280×280 viewBox — caller decides display size.
 */
interface IllustrationFindProps {
  size?: number;
}

export function IllustrationFind({ size = 280 }: IllustrationFindProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 280 280">
      <Defs>
        <LinearGradient id="findBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#EAF2FB" />
          <Stop offset="100%" stopColor="#F5F8FC" />
        </LinearGradient>
        <LinearGradient id="findActivePin" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colors.brand[500]} />
          <Stop offset="100%" stopColor={colors.brand[700]} />
        </LinearGradient>
      </Defs>

      {/* Background card */}
      <Rect x={0} y={0} width={280} height={280} rx={32} ry={32} fill="url(#findBg)" />

      {/* Park blocks */}
      <Rect x={210} y={36} width={50} height={36} rx={10} fill="#D5E7DA" opacity={0.7} />
      <Rect x={26} y={206} width={56} height={48} rx={10} fill="#D5E7DA" opacity={0.7} />

      {/* Wide curving roads */}
      <Path
        d="M-10 88 Q70 56 150 96 T300 70"
        stroke="#FFFFFF"
        strokeWidth={18}
        fill="none"
        opacity={0.95}
      />
      <Path
        d="M-10 88 Q70 56 150 96 T300 70"
        stroke="#CFD9E2"
        strokeWidth={1}
        fill="none"
        opacity={0.7}
      />
      <Path
        d="M-10 180 Q90 168 180 196 T300 220"
        stroke="#FFFFFF"
        strokeWidth={14}
        fill="none"
        opacity={0.9}
      />
      <Path
        d="M64 -10 Q88 140 56 290"
        stroke="#FFFFFF"
        strokeWidth={16}
        fill="none"
        opacity={0.95}
      />
      <Path
        d="M200 -10 Q224 140 188 290"
        stroke="#FFFFFF"
        strokeWidth={12}
        fill="none"
        opacity={0.85}
      />

      {/* Small passive pin 1 (top-left) */}
      <PassivePin cx={66} cy={68} />

      {/* Small passive pin 2 (right) */}
      <PassivePin cx={224} cy={148} />

      {/* "You are here" — coral dot with pulse ring (left-center) */}
      <Circle cx={104} cy={184} r={22} fill={colors.accent[500]} opacity={0.18} />
      <Circle cx={104} cy={184} r={12} fill={colors.accent[500]} opacity={0.32} />
      <Circle cx={104} cy={184} r={7} fill={colors.accent[500]} />
      <Circle cx={104} cy={184} r={2.5} fill="#FFFFFF" />

      {/* Big active pin — drop shape (right-center, prominent) */}
      {/* Drop body */}
      <Path
        d="M180 100c-20 0-36 16-36 36 0 24 30 50 36 54 6-4 36-30 36-54 0-20-16-36-36-36z"
        fill="url(#findActivePin)"
      />
      {/* Inner white circle */}
      <Circle cx={180} cy={136} r={14} fill="#FFFFFF" />
      {/* Tiny brand mark inside */}
      <Path
        d="M180 128c1.5 1.8 3.4 4 3.4 5.8 0 1.9-1.5 3.4-3.4 3.4s-3.4-1.5-3.4-3.4c0-1.8 1.9-4 3.4-5.8z"
        fill={colors.brand[500]}
      />
    </Svg>
  );
}

function PassivePin({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      {/* Drop body */}
      <Path
        d={`M${cx} ${cy - 18}c-12 0-22 10-22 22 0 14 18 30 22 32 4-2 22-18 22-32 0-12-10-22-22-22z`}
        fill="#FFFFFF"
        stroke={colors.brand[100]}
        strokeWidth={1.5}
      />
      {/* Inner dot */}
      <Circle cx={cx} cy={cy + 4} r={6} fill={colors.brand[500]} opacity={0.85} />
    </>
  );
}
