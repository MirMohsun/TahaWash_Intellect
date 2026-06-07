import type { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/tokens';
import { Button } from './Button';

interface FilterSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  /** When provided, renders a Reset button next to Done. */
  onReset?: () => void;
  resetLabel?: string;
  doneLabel?: string;
  children: ReactNode;
}

/**
 * Bottom-sheet filter modal. Filters apply live (each control updates state
 * immediately), so "Done" just closes and "Reset" clears. Backdrop tap and
 * Android back also close. Flat styling on a dim backdrop (no elevation) to
 * avoid the Fabric rounded-shadow artifacts seen elsewhere.
 */
export function FilterSheet({
  visible,
  title,
  onClose,
  onReset,
  resetLabel,
  doneLabel,
  children,
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.bgElev,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.line,
              marginBottom: 16,
            }}
          />
          <Text
            style={{
              fontFamily: 'Inter_800ExtraBold',
              fontSize: 18,
              color: colors.ink[900],
              marginBottom: 16,
            }}
          >
            {title}
          </Text>

          {children}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
            {onReset ? (
              <View style={{ flex: 1 }}>
                <Button variant="ghost" full onPress={onReset}>
                  {resetLabel ?? 'Reset'}
                </Button>
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Button variant="primary" full onPress={onClose}>
                {doneLabel ?? 'Done'}
              </Button>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Selectable pill used inside a FilterSheet (single- or multi-select). */
export function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(14,122,231,0.12)' }}
      style={{
        height: 40,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: active ? colors.brand[500] : colors.line,
        backgroundColor: active ? colors.brand[50] : colors.bgElev,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Text
        style={{
          fontFamily: 'Inter_700Bold',
          fontSize: 13,
          color: active ? colors.brand[700] : colors.ink[700],
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
