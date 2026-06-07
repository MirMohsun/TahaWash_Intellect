import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/**
 * Pulsing placeholder block for content that's loading.
 *
 * Implementation note: the web design used a diagonal-stripe gradient
 * shimmer. On RN we use a simpler opacity pulse (Reanimated) — it reads
 * the same at a glance, and avoids pulling in a gradient pass per
 * skeleton instance. Swap to a shimmer if the design lead pushes back.
 */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.8, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: '#ECEEF1',
        } as ViewStyle,
        animatedStyle,
        style,
      ]}
    >
      <View />
    </Animated.View>
  );
}
