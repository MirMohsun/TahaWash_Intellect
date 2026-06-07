import { type ReactNode } from 'react';
import { Text, View, type ViewStyle } from 'react-native';

interface PillProps {
  children: ReactNode;
  /** Text color. Defaults to ink-700. */
  color?: string;
  /** Background color. Defaults to line-soft. */
  bg?: string;
  /** Optional leading icon (small, color-inheriting). */
  leading?: ReactNode;
  /** Optional trailing icon. */
  trailing?: ReactNode;
  style?: ViewStyle;
}

/**
 * Inline-flex pill badge — used for tenant status, payment method,
 * service icons, "open now" indicators, etc.
 *
 * Color presets the rest of the app uses:
 *   status active   → bg lineSoft, color ink-700  (default)
 *   status closed   → bg errorSoft, color error
 *   "paid"          → bg successSoft, color success
 *   subscription    → bg amberSoft, color amber (warning) / errorSoft, error (expired)
 */
export function Pill({
  children,
  color = '#3A4250',
  bg = '#F2F3F5',
  leading,
  trailing,
  style,
}: PillProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: bg,
          gap: 4,
        },
        style,
      ]}
    >
      {leading}
      <Text style={{ color, fontFamily: 'Inter_600SemiBold', fontSize: 12, letterSpacing: -0.1 }}>
        {children}
      </Text>
      {trailing}
    </View>
  );
}
