import { type ReactNode } from 'react';
import { Pressable, View, type ViewProps, type ViewStyle } from 'react-native';
import { shadows } from '../../theme/tokens';

interface CardProps extends ViewProps {
  /** Press handler. When provided, the card becomes a Pressable with subtle opacity feedback. */
  onPress?: () => void;
  /** Override default 16px padding. Pass 0 for edge-to-edge children (rare). */
  padding?: number;
  /** Override default 16px radius (rounded-card). Pass 12 for the small variant. */
  radius?: number;
  /** Disable the default shadow — useful for nested cards or selection states. */
  flat?: boolean;
  children?: ReactNode;
}

/**
 * Wolt-style inset card. THE primary surface for content blocks.
 *
 * Never use full-width edge-to-edge banners — every block of content
 * sits inside a Card. This is one of the non-negotiables locked in
 * the design system memory.
 *
 * iOS gets shadowColor/Offset/Opacity/Radius; Android gets elevation.
 * Both come from `shadows.card` in theme/tokens.
 */
export function Card({
  onPress,
  padding = 16,
  radius = 16,
  flat = false,
  children,
  style,
  ...rest
}: CardProps) {
  const base: ViewStyle = {
    backgroundColor: '#FFFFFF',
    borderRadius: radius,
    borderWidth: 1,
    borderColor: '#ECEEF1',
    padding,
    ...(flat ? {} : shadows.card),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, pressed ? { opacity: 0.85 } : null, style as ViewStyle]}
        {...(rest as Omit<typeof rest, 'style'>)}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[base, style]} {...rest}>
      {children}
    </View>
  );
}
