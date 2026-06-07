import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from '../../theme/tokens';

/**
 * Slide 3 — "One app, every wash"
 *
 * Hero Tahawash water-drop logo enlarged + ringed with sparkles + a
 * minimal "saved card" chip beneath. Signals: the brand is the constant,
 * payment is one-tap, and the wash itself is the magic moment.
 *
 * Composition:
 *   - Soft brand-tinted background
 *   - Halo ring behind the water-drop
 *   - Large Tahawash drop (gradient blue), proportionally enlarged from
 *     the Logo component's geometry so visual consistency is exact
 *   - Coral + brand sparkles around the drop
 *   - Small minimalist card chip below (with brand chip + masked digits)
 *   - Tiny checkmark badge in the bottom-right corner of the drop
 */
interface IllustrationPayProps {
  size?: number;
}

export function IllustrationPay({ size = 280 }: IllustrationPayProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 280 280">
      <Defs>
        <LinearGradient id="payBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#EAF2FB" />
          <Stop offset="100%" stopColor="#F5F8FC" />
        </LinearGradient>
        <LinearGradient id="payDrop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#4692E3" />
          <Stop offset="100%" stopColor="#2276D6" />
        </LinearGradient>
        <LinearGradient id="payCard" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={colors.brand[500]} />
          <Stop offset="100%" stopColor={colors.brand[700]} />
        </LinearGradient>
      </Defs>

      {/* Background card */}
      <Rect x={0} y={0} width={280} height={280} rx={32} ry={32} fill="url(#payBg)" />

      {/* Halo rings behind the drop */}
      <Circle cx={140} cy={120} r={94} fill={colors.brand[500]} opacity={0.07} />
      <Circle cx={140} cy={120} r={72} fill={colors.brand[500]} opacity={0.1} />

      {/* Sparkles around the drop */}
      <Sparkle cx={48} cy={68} size={9} color={colors.accent[500]} />
      <Sparkle cx={228} cy={50} size={7} color={colors.brand[500]} opacity={0.85} />
      <Sparkle cx={242} cy={160} size={8} color={colors.accent[500]} opacity={0.9} />
      <Sparkle cx={36} cy={170} size={6} color={colors.brand[500]} opacity={0.8} />
      <Sparkle cx={88} cy={26} size={4} color={colors.brand[500]} opacity={0.6} />

      {/* Tahawash water-drop logo — scaled from 40px viewBox to ~120px */}
      {/* Translate so drop body is centered around (140, 120). The original
          drop path is 40×40 with the drop body ending around y=36. We scale
          by 3 and offset to center. */}
      <G transform="translate(80 60) scale(3)">
        {/* Drop body */}
        <Path d="M20 4c5 6 11 13 11 19a11 11 0 0 1-22 0c0-6 6-13 11-19z" fill="url(#payDrop)" />
        {/* Wash arc */}
        <Path
          d="M14 24c2 2 4 3 6 3s4-1 6-3"
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      </G>

      {/* Checkmark badge — bottom-right of the drop */}
      <G>
        <Circle cx={196} cy={170} r={20} fill={colors.success} />
        <Circle cx={196} cy={170} r={20} fill="#FFFFFF" opacity={0.15} />
        <Path
          d="M186 170 L194 178 L208 162"
          stroke="#FFFFFF"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </G>

      {/* Saved-card chip — below the drop */}
      <G>
        <Rect x={64} y={224} width={152} height={36} rx={10} fill="url(#payCard)" />
        {/* Card "chip" */}
        <Rect x={76} y={234} width={16} height={12} rx={2.5} fill="#FFD480" opacity={0.95} />
        {/* Card "stripe" with masked digits */}
        <Circle cx={108} cy={240} r={2} fill="#FFFFFF" opacity={0.85} />
        <Circle cx={116} cy={240} r={2} fill="#FFFFFF" opacity={0.85} />
        <Circle cx={124} cy={240} r={2} fill="#FFFFFF" opacity={0.85} />
        <Circle cx={132} cy={240} r={2} fill="#FFFFFF" opacity={0.85} />
        {/* Last 4 digits placeholder */}
        <Rect x={144} y={236} width={4} height={2.5} rx={1} fill="#FFFFFF" opacity={0.95} />
        <Rect x={150} y={236} width={4} height={2.5} rx={1} fill="#FFFFFF" opacity={0.95} />
        <Rect x={156} y={236} width={4} height={2.5} rx={1} fill="#FFFFFF" opacity={0.95} />
        <Rect x={162} y={236} width={4} height={2.5} rx={1} fill="#FFFFFF" opacity={0.95} />
        {/* "VISA" stripe at far right */}
        <Rect x={186} y={234} width={20} height={12} rx={2} fill="#FFFFFF" opacity={0.95} />
      </G>
    </Svg>
  );
}

function Sparkle({
  cx,
  cy,
  size = 6,
  color,
  opacity = 1,
}: {
  cx: number;
  cy: number;
  size?: number;
  color: string;
  opacity?: number;
}) {
  return (
    <G opacity={opacity}>
      <Path
        d={`M${cx} ${cy - size} L${cx + size * 0.38} ${cy} L${cx} ${cy + size} L${cx - size * 0.38} ${cy} Z`}
        fill={color}
      />
      <Path
        d={`M${cx - size} ${cy} L${cx} ${cy - size * 0.38} L${cx + size} ${cy} L${cx} ${cy + size * 0.38} Z`}
        fill={color}
        opacity={0.65}
      />
    </G>
  );
}
