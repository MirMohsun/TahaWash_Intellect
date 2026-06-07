import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, shadows } from '../../theme/tokens';

const FRAME = 256;
const CORNER = 28;
const CORNER_STROKE = 3;

/**
 * 256×256 scan target overlay — 4 brand-tinted L-shaped corner brackets
 * and a horizontal sweep line that pulses up and down inside the frame.
 *
 * Matches Design_Mobile_App/app/screens-a.jsx → ScreenScanner frame +
 * Corner + sweep line. The dim mask around the frame lives in the
 * parent scanner screen so we don't need to know the screen height here.
 */
export function ScanFrame() {
  const offset = useSharedValue(-FRAME / 2 + 20);

  useEffect(() => {
    offset.value = withRepeat(
      withSequence(
        withTiming(FRAME / 2 - 20, { duration: 1400 }),
        withTiming(-FRAME / 2 + 20, { duration: 1400 }),
      ),
      -1,
      false,
    );
  }, [offset]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  return (
    <View
      style={{
        width: FRAME,
        height: FRAME,
      }}
      pointerEvents="none"
    >
      {/* Corners */}
      <Corner position="tl" />
      <Corner position="tr" />
      <Corner position="bl" />
      <Corner position="br" />

      {/* Sweep line — pulses inside the frame */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: '50%',
            left: 8,
            right: 8,
            height: 2,
            backgroundColor: colors.brand[500],
          },
          shadows.fab,
          sweepStyle,
        ]}
      />
    </View>
  );
}

function Corner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = {
    position: 'absolute' as const,
    width: CORNER,
    height: CORNER,
    borderColor: colors.brand[500],
  };
  switch (position) {
    case 'tl':
      return (
        <View
          style={[
            base,
            {
              top: 0,
              left: 0,
              borderTopWidth: CORNER_STROKE,
              borderLeftWidth: CORNER_STROKE,
              borderTopLeftRadius: 12,
            },
          ]}
        />
      );
    case 'tr':
      return (
        <View
          style={[
            base,
            {
              top: 0,
              right: 0,
              borderTopWidth: CORNER_STROKE,
              borderRightWidth: CORNER_STROKE,
              borderTopRightRadius: 12,
            },
          ]}
        />
      );
    case 'bl':
      return (
        <View
          style={[
            base,
            {
              bottom: 0,
              left: 0,
              borderBottomWidth: CORNER_STROKE,
              borderLeftWidth: CORNER_STROKE,
              borderBottomLeftRadius: 12,
            },
          ]}
        />
      );
    case 'br':
      return (
        <View
          style={[
            base,
            {
              bottom: 0,
              right: 0,
              borderBottomWidth: CORNER_STROKE,
              borderRightWidth: CORNER_STROKE,
              borderBottomRightRadius: 12,
            },
          ]}
        />
      );
  }
}

export const SCAN_FRAME_SIZE = FRAME;
