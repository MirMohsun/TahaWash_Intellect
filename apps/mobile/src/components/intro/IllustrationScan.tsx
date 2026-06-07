import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { colors } from '../../theme/tokens';

/**
 * Slide 2 — "Scan, pay, wash"
 *
 * A stylised phone holding a QR sticker mid-scan, with a horizontal
 * brand-gradient scan beam and a floating "₼ 2,50" amount chip — the
 * three concepts users meet in the wild: the bay sticker, the camera,
 * and the charge counter.
 *
 * Composition:
 *   - Soft brand-tinted square background
 *   - Phone outline (rounded card) with screen surface
 *   - QR-style pattern inside the screen (geometric, not a real QR)
 *   - 4 viewfinder corner brackets
 *   - Horizontal scan beam (brand gradient line + soft glow)
 *   - Floating amount pill above the phone (coral accent)
 *   - Small water-drop sparkles on the side
 */
interface IllustrationScanProps {
  size?: number;
}

export function IllustrationScan({ size = 280 }: IllustrationScanProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 280 280">
      <Defs>
        <LinearGradient id="scanBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#EAF2FB" />
          <Stop offset="100%" stopColor="#F5F8FC" />
        </LinearGradient>
        <LinearGradient id="scanBeam" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={colors.brand[500]} stopOpacity={0} />
          <Stop offset="50%" stopColor={colors.brand[500]} stopOpacity={0.9} />
          <Stop offset="100%" stopColor={colors.brand[500]} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="amountPill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#FFF6F4" />
        </LinearGradient>
      </Defs>

      {/* Background card */}
      <Rect x={0} y={0} width={280} height={280} rx={32} ry={32} fill="url(#scanBg)" />

      {/* Decorative sparkles — left side */}
      <Sparkle cx={32} cy={64} size={6} color={colors.accent[500]} />
      <Sparkle cx={52} cy={120} size={4} color={colors.brand[500]} opacity={0.7} />
      <Sparkle cx={20} cy={188} size={5} color={colors.accent[500]} opacity={0.85} />

      {/* Decorative sparkles — right side */}
      <Sparkle cx={252} cy={88} size={5} color={colors.brand[500]} opacity={0.8} />
      <Sparkle cx={244} cy={200} size={6} color={colors.accent[500]} />

      {/* Phone body */}
      <G>
        {/* Outer phone */}
        <Rect
          x={86}
          y={50}
          width={108}
          height={196}
          rx={20}
          ry={20}
          fill="#FFFFFF"
          stroke={colors.line}
          strokeWidth={2}
        />
        {/* Notch */}
        <Rect x={126} y={56} width={28} height={6} rx={3} fill="#E5EAF0" />
        {/* Screen surface */}
        <Rect x={94} y={70} width={92} height={158} rx={12} fill="#0B1726" />

        {/* QR pattern inside screen */}
        <QrPattern x={104} y={94} size={72} />

        {/* Viewfinder brackets */}
        <Brackets x={100} y={90} size={80} />

        {/* Scan beam */}
        <Rect x={102} y={150} width={68} height={3} rx={1.5} fill="url(#scanBeam)" />
        {/* Beam soft glow above */}
        <Rect
          x={102}
          y={144}
          width={68}
          height={6}
          rx={3}
          fill={colors.brand[500]}
          opacity={0.18}
        />

        {/* Home indicator */}
        <Rect x={124} y={234} width={32} height={3} rx={1.5} fill="#E5EAF0" />
      </G>

      {/* Floating amount pill above phone — coral accent */}
      <G>
        <Rect
          x={104}
          y={28}
          width={72}
          height={28}
          rx={14}
          fill="url(#amountPill)"
          stroke={colors.accent[500]}
          strokeWidth={1.5}
        />
        <Circle cx={117} cy={42} r={6} fill={colors.accent[500]} />
        <SvgText x={128} y={47} fontFamily="Inter_700Bold" fontSize={13} fill={colors.ink[900]}>
          2,50 ₼
        </SvgText>
      </G>
    </Svg>
  );
}

/**
 * 6×6 QR-style grid for visual cue (NOT a real scannable QR — just
 * graphic shorthand). Three corner finder patterns + scattered dark cells.
 */
function QrPattern({ x, y, size }: { x: number; y: number; size: number }) {
  const cell = size / 7;
  // Hand-picked dark cells for a "looks like QR" pattern. Index pairs (col, row), 0..6.
  const cells: ReadonlyArray<[number, number]> = [
    // Finder TL
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    // Finder TR
    [4, 0],
    [5, 0],
    [6, 0],
    [4, 1],
    [6, 1],
    [4, 2],
    [5, 2],
    [6, 2],
    // Finder BL
    [0, 4],
    [1, 4],
    [2, 4],
    [0, 5],
    [2, 5],
    [0, 6],
    [1, 6],
    [2, 6],
    // Scattered data cells
    [4, 4],
    [5, 5],
    [6, 6],
    [3, 3],
    [5, 3],
    [3, 5],
    [6, 4],
    [4, 6],
    [3, 1],
    [3, 6],
  ];

  return (
    <G>
      {cells.map(([c, r], i) => (
        <Rect
          key={i}
          x={x + c * cell}
          y={y + r * cell}
          width={cell - 1}
          height={cell - 1}
          rx={1.5}
          fill="#FFFFFF"
        />
      ))}
    </G>
  );
}

/** 4 corner viewfinder brackets centered around a square region. */
function Brackets({ x, y, size }: { x: number; y: number; size: number }) {
  const arm = 12;
  const stroke = 2.2;
  const c = colors.brand[500];
  return (
    <G>
      {/* TL */}
      <Path
        d={`M${x} ${y + arm} V${y} H${x + arm}`}
        stroke={c}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
      />
      {/* TR */}
      <Path
        d={`M${x + size - arm} ${y} H${x + size} V${y + arm}`}
        stroke={c}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
      />
      {/* BL */}
      <Path
        d={`M${x} ${y + size - arm} V${y + size} H${x + arm}`}
        stroke={c}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
      />
      {/* BR */}
      <Path
        d={`M${x + size - arm} ${y + size} H${x + size} V${y + size - arm}`}
        stroke={c}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
      />
    </G>
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
  // 4-pointed sparkle ("twinkle") with horizontal + vertical diamond rays.
  return (
    <G opacity={opacity}>
      <Path
        d={`M${cx} ${cy - size} L${cx + size * 0.4} ${cy} L${cx} ${cy + size} L${cx - size * 0.4} ${cy} Z`}
        fill={color}
      />
      <Path
        d={`M${cx - size} ${cy} L${cx} ${cy - size * 0.4} L${cx + size} ${cy} L${cx} ${cy + size * 0.4} Z`}
        fill={color}
        opacity={0.7}
      />
    </G>
  );
}
