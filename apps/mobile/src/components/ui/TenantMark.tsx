import { Text, View } from 'react-native';

interface TenantMarkProps {
  /** Tenant name — hashed to pick a deterministic colorway. */
  name: string;
  size?: number;
  /** Override the auto-picked background. */
  bg?: string;
  /** Override the auto-picked foreground (initials color). */
  fg?: string;
  /** Override default 0.28×size radius. */
  radius?: number;
}

/**
 * Tenant logo placeholder — initials inside a colored rounded-square.
 *
 * Used when a tenant hasn't uploaded a real logo yet, and as a fallback
 * if the logo URL fails to load. Color is picked deterministically from
 * the name's char-code sum so the same tenant always gets the same
 * colorway — matters for visual recall in the favorites strip + history.
 */
export function TenantMark({ name, size = 40, bg, fg, radius }: TenantMarkProps) {
  const palette = pickPalette(name);
  const initials = name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? size * 0.28,
        backgroundColor: bg ?? palette.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: fg ?? palette.fg,
          fontFamily: 'Inter_800ExtraBold',
          fontSize: size * 0.4,
          letterSpacing: -0.5,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

const PALETTES: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: '#0E7AE7', fg: '#FFFFFF' }, // brand blue
  { bg: '#1F2531', fg: '#FFD66E' }, // ink + amber
  { bg: '#3460E8', fg: '#FFFFFF' }, // deep blue
  { bg: '#0F65F2', fg: '#FFFFFF' }, // success blue
  { bg: '#FF6E54', fg: '#FFFFFF' }, // coral
  { bg: '#F5EFE6', fg: '#1F2531' }, // light
];

function pickPalette(name: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h += name.charCodeAt(i);
  }
  return PALETTES[h % PALETTES.length]!;
}
