/**
 * Tahawash design tokens — TypeScript constants.
 *
 * NativeWind classes cover most styling, but some properties can't come
 * from Tailwind in React Native (gradients, complex shadows, native
 * StatusBar colors, etc.). Those reach for the values here so we keep a
 * single source of truth — these values mirror tailwind.config.js
 * exactly.
 *
 * Brand pivot 2026-05-27: aqua-teal → blue. Success color also flipped
 * to blue per user (#0F65F2). See project_yubox_DESIGN_SYSTEM_LOCKED.md
 * in memory for full history.
 */

import { Platform, type ViewStyle } from 'react-native';

export const colors = {
  brand: {
    50: '#FAFEFF',
    100: '#5099D4',
    200: '#4692E3',
    500: '#0E7AE7',
    600: '#2276D6',
    700: '#1C5AD6',
    900: '#1741BF',
  },
  accent: {
    50: '#FFE9E3',
    500: '#FF6E54',
  },
  bg: '#F6F7F8',
  bgElev: '#FFFFFF',
  line: '#ECEEF1',
  lineSoft: '#F2F3F5',
  ink: {
    300: '#C5CAD2',
    400: '#9AA1AB',
    500: '#6B7280',
    700: '#3A4250',
    800: '#1F2531',
    900: '#14181F',
  },
  success: '#0F65F2',
  successSoft: '#E6F8F0',
  error: '#EF4444',
  errorSoft: '#FEECEC',
  amber: '#F59E0B',
  amberSoft: '#FFF6E5',
  white: '#FFFFFF',
} as const;

export const radii = {
  card: 16,
  cardSm: 12,
  pill: 999,
} as const;

/**
 * Cross-platform shadow presets. iOS uses shadowColor/Offset/Opacity/Radius;
 * Android uses elevation. Spread these into a `style` prop.
 */
export const shadows = {
  /** Default card shadow — subtle, used on every Wolt-style inset card */
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#14181F',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 16,
    },
    android: { elevation: 2 },
    default: {},
  }),
  /** Stronger shadow — used on popovers, sheets, modals */
  pop: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#14181F',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
    },
    android: { elevation: 8 },
    default: {},
  }),
  /** Brand-tinted glow — primary CTAs + raised FAB.
      Android elevation kept at 6 (was 12): on RN 0.76 + Fabric some devices'
      shadow renderer composited the high-elevation layer on top of the fill,
      making the button's blue background invisible. 6 is plenty for a CTA
      drop-shadow without triggering the bug. */
  fab: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#2276D6', // brand-600
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
    },
    android: { elevation: 6 },
    default: {},
  }),
} as const;

/**
 * Brand gradients (for expo-linear-gradient).
 * Tuple-typed because LinearGradient.colors is `[string, string, ...string[]]`.
 */
export const gradients = {
  /** Tahawash logo body gradient */
  logo: ['#4692E3', '#2276D6'] as const,
  /** Hero promo card on Main tab (3-stop) */
  promo: ['#2276D6', '#0E7AE7', '#4692E3'] as const,
  /** Profile avatar circle */
  avatar: ['#0E7AE7', '#2276D6'] as const,
} as const;

/**
 * Per-banner gradients for the Main-tab promo carousel. Each active promo
 * picks one by its position so multiple banners render in visually distinct
 * colors. First entry is the original promo blue (single-banner look is
 * unchanged). Used only when a promo has no uploaded imageUrl — an image
 * promo shows its photo instead.
 */
export const promoPalette = [
  ['#2276D6', '#0E7AE7', '#4692E3'], // blue
  ['#7C3AED', '#6D28D9', '#9333EA'], // violet
  ['#0E9488', '#0F766E', '#14B8A6'], // teal
  ['#EA580C', '#F97316', '#FB923C'], // amber
] as const;

/**
 * Named promo themes — the color a super-admin picks per banner. Keys match
 * the admin picker + the backend `theme` enum. When a promo has no theme the
 * carousel falls back to promoPalette by position.
 */
export const promoThemes = {
  blue: promoPalette[0],
  violet: promoPalette[1],
  teal: promoPalette[2],
  amber: promoPalette[3],
} as const;

/**
 * Inter-specific font feature flags + letter-spacing. RN doesn't expose
 * font-feature-settings directly, but we apply -0.01em as a baseline
 * letter-spacing to body text via this constant.
 *
 * In TS-land RN's letterSpacing is in points (px-ish), not em. -0.01em at
 * 16px ≈ -0.16, at 14px ≈ -0.14. We pick a slightly negative absolute
 * value that reads well across our common type sizes.
 */
export const typography = {
  letterSpacingTight: -0.2,
  /** Family names registered with expo-font in useAppFonts() */
  family: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    extrabold: 'Inter_800ExtraBold',
  },
} as const;

export const tokens = {
  colors,
  radii,
  shadows,
  gradients,
  typography,
};

export type Tokens = typeof tokens;
