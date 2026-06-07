import { Pressable, View } from 'react-native';
import { colors, shadows } from '../../theme/tokens';
import { Icon } from './Icon';

interface BackButtonProps {
  onPress: () => void;
  /** When the screen behind is dark (camera, dark hero), switch to a glass-on-dark style. */
  onDark?: boolean;
}

/**
 * Circular 40×40 back button positioned by the parent (not absolutely
 * pinned here — callers decide where it goes, usually top: 16, left: 16
 * inside a SafeAreaView).
 *
 * Two variants:
 *   light (default) — solid white circle on light hero / sheet
 *   dark            — translucent black with white icon (camera scanner)
 */
export function BackButton({ onPress, onDark = false }: BackButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <View
        style={[
          {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: onDark ? 'rgba(0,0,0,0.45)' : colors.white,
            borderWidth: 1,
            borderColor: onDark ? 'rgba(255,255,255,0.18)' : colors.line,
          },
          onDark ? null : shadows.card,
        ]}
      >
        <Icon name="back" size={20} stroke={2} color={onDark ? colors.white : colors.ink[900]} />
      </View>
    </Pressable>
  );
}
