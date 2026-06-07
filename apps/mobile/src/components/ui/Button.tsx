import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import { colors, shadows } from '../../theme/tokens';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

interface ButtonProps {
  children: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon (renders before children with 8px gap). */
  leading?: ReactNode;
  /** Optional trailing icon. */
  trailing?: ReactNode;
  /** Stretch to fill the parent. */
  full?: boolean;
  /** Disable interaction + dim. */
  disabled?: boolean;
  /** Show a spinner inside the button. Children stay rendered (hidden) to preserve width. */
  loading?: boolean;
  /** Accessibility label override. Defaults to the children string when possible. */
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/**
 * Tahawash button — 3 sizes × 4 variants.
 *
 * The primary variant carries the brand-tinted FAB glow (shadows.fab).
 * Outline + ghost + danger are flat. Press feedback dims to 0.85 opacity.
 *
 * Touch target ≥ 44pt on every size (lg=56, md=44, sm=36 — sm is below
 * Apple's 44 minimum but is reserved for dense secondary actions like
 * "Cancel" chips inside cards; never use for primary nav).
 */
export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'lg',
  leading,
  trailing,
  full = false,
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];

  // Static style array — Fabric (new arch) on RN 0.76 has surfaced cases
  // where Pressable's function-style prop loses backgroundColor on first
  // paint. Keeping the resolved style static-flat avoids that.
  const baseStyle: ViewStyle = {
    height: s.height,
    paddingHorizontal: s.paddingX,
    borderRadius: 999,
    backgroundColor: v.bg,
    borderWidth: v.borderWidth,
    borderColor: v.borderColor,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: full ? 'stretch' : 'flex-start',
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      accessibilityLabel={accessibilityLabel}
      android_ripple={
        variant === 'primary' && !disabled ? { color: 'rgba(255,255,255,0.18)' } : undefined
      }
      style={[
        baseStyle,
        variant === 'primary' && !disabled ? shadows.fab : null,
        style,
      ]}
    >
      {leading}
      <View style={{ position: 'relative', flexDirection: 'row', alignItems: 'center' }}>
        <Text
          style={{
            color: v.fg,
            fontSize: s.fontSize,
            fontFamily: 'Inter_600SemiBold',
            letterSpacing: -0.1,
            opacity: loading ? 0 : 1,
          }}
          numberOfLines={1}
        >
          {children}
        </Text>
        {loading ? (
          <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={v.fg} />
          </View>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

const VARIANTS: Record<
  ButtonVariant,
  { bg: string; fg: string; borderWidth: number; borderColor: string }
> = {
  primary: {
    bg: colors.brand[500],
    fg: colors.white,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  outline: {
    bg: colors.white,
    fg: colors.ink[900],
    borderWidth: 1,
    borderColor: colors.line,
  },
  ghost: {
    bg: 'transparent',
    fg: colors.brand[600],
    borderWidth: 0,
    borderColor: 'transparent',
  },
  danger: {
    bg: 'transparent',
    fg: colors.error,
    borderWidth: 0,
    borderColor: 'transparent',
  },
};

const SIZES: Record<ButtonSize, { height: number; paddingX: number; fontSize: number }> = {
  lg: { height: 56, paddingX: 22, fontSize: 16 },
  md: { height: 44, paddingX: 16, fontSize: 15 },
  sm: { height: 36, paddingX: 14, fontSize: 13 },
};
