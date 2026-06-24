import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import { useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../ui/Icon';
import { colors, shadows } from '../../theme/tokens';

/**
 * Tahawash bottom navigation — custom because Expo Router / React
 * Navigation's default tab bar doesn't support a RAISED center button
 * (the QR FAB sits 26pt above the bar with a brand-tinted glow).
 *
 * Layout (matches `Design_Mobile_App/app/common.jsx` → TwBottomNav):
 *   - Height 88pt (incl. 22pt safe-area padding)
 *   - White background, 1px line border-top
 *   - 4 tab slots + 1 raised FAB at center index
 *   - Tab 3 (Scan) is a 60×60 circle raised -26pt above the bar,
 *     brand-500 fill, 4pt white border, brand-tinted FAB glow
 *
 * The FAB is NOT a tab — tapping it pushes /scanner (route outside the
 * (tabs) group), which presents full-screen and hides the bar
 * automatically. This is the right architecture for camera screens:
 * the scanner needs the whole screen, the tab nav comes back on close.
 *
 * Active states (spec lock):
 *   - Icon stroke 2.1 (vs 1.75 inactive)
 *   - Label weight 600 (vs 500 inactive)
 *   - Color brand-600 (vs ink-400 inactive)
 */

interface TabDef {
  routeName: string;
  i18nKey: string;
  icon: IconName;
}

/** The 4 actual tabs. Scan is rendered separately as the raised FAB. */
const TAB_ORDER: ReadonlyArray<TabDef> = [
  { routeName: 'main', i18nKey: 'tabs.main', icon: 'home' },
  { routeName: 'wash', i18nKey: 'tabs.wash', icon: 'map' },
  { routeName: 'history', i18nKey: 'tabs.history', icon: 'history' },
  { routeName: 'profile', i18nKey: 'tabs.profile', icon: 'user' },
];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Report THIS bar's real height to React Navigation so useBottomTabBarHeight()
  // returns the floating island's true footprint (FAB room + island + safe-area),
  // not the navigator's ~49+inset default. The default BottomTabBar does this via
  // onLayout; a custom tab bar must do it too, otherwise scroll screens under-pad
  // and the last row gets hidden behind the island.
  const setTabBarHeight = useContext(BottomTabBarHeightCallbackContext);
  // Bottom inset: clamp to a small value when there's no nav bar (gesture
  // phones) so the floating island doesn't hover with a giant air gap.
  const bottomGap = Math.max(insets.bottom, 10);

  const tabs = useMemo(() => {
    return TAB_ORDER.map((def) => {
      const stateIndex = state.routes.findIndex((r) => r.name === def.routeName);
      return {
        ...def,
        stateIndex,
        focused: stateIndex >= 0 && state.index === stateIndex,
        key: stateIndex >= 0 ? state.routes[stateIndex]!.key : def.routeName,
      };
    });
  }, [state]);

  const handleTabPress = (routeName: string, stateIndex: number, key: string, focused: boolean) => {
    if (stateIndex < 0) return;
    const event = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  const handleFabPress = () => {
    // Scanner sits OUTSIDE (tabs), so this is a stack push from the
    // root Stack — it'll cover the tab bar automatically.
    router.push('/scanner');
  };

  // Split tabs left/right of the FAB.
  const leftTabs = tabs.slice(0, 2);
  const rightTabs = tabs.slice(2);

  // Outer slot: ABSOLUTELY positioned over the bottom of the screen so the
  // island genuinely floats — the scene fills the full height behind it and
  // its own content/background is what shows through the transparent gaps
  // (no full-width navigator slab behind the pill). paddingHorizontal 10 so
  // the island reads wide; pointerEvents='box-none' lets taps outside the
  // island reach the map / list underneath.
  return (
    <View
      pointerEvents="box-none"
      onLayout={(e) => setTabBarHeight?.(e.nativeEvent.layout.height)}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 10,
        paddingBottom: bottomGap,
        paddingTop: 20, // room for the raised FAB to peek out above the island
        backgroundColor: 'transparent',
      }}
    >
      <View
        style={{
          backgroundColor: colors.bgElev,
          borderRadius: 28,
          paddingTop: 10,
          paddingBottom: 8,
          paddingHorizontal: 6,
          flexDirection: 'row',
          alignItems: 'flex-start',
          // Equal slots all the way across so the FAB sits dead center
          // between Wash and History — the previous mix of flex:1 tabs +
          // width:72 FAB pushed the FAB slightly off-axis.
          justifyContent: 'space-between',
          overflow: 'visible',
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        {leftTabs.map((tab) => (
          <RegularTab
            key={tab.routeName}
            icon={tab.icon}
            label={t(tab.i18nKey)}
            focused={tab.focused}
            onPress={() => handleTabPress(tab.routeName, tab.stateIndex, tab.key, tab.focused)}
          />
        ))}

        <FabSlot label={t('tabs.scan')} onPress={handleFabPress} />

        {rightTabs.map((tab) => (
          <RegularTab
            key={tab.routeName}
            icon={tab.icon}
            label={t(tab.i18nKey)}
            focused={tab.focused}
            onPress={() => handleTabPress(tab.routeName, tab.stateIndex, tab.key, tab.focused)}
          />
        ))}
      </View>
    </View>
  );
}

interface RegularTabProps {
  icon: IconName;
  label: string;
  focused: boolean;
  onPress: () => void;
}

function RegularTab({ icon, label, focused, onPress }: RegularTabProps) {
  const color = focused ? colors.brand[600] : colors.ink[400];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 2 }}
    >
      {/* Soft brand pill behind the active tab's icon — a Material-3-style
          selection cue. Same footprint on every tab (transparent when
          inactive) so the row stays vertically aligned. */}
      <View
        style={{
          height: 30,
          paddingHorizontal: 16,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: focused ? 'rgba(14,122,231,0.12)' : 'transparent',
        }}
      >
        <Icon name={icon} size={23} stroke={focused ? 2.1 : 1.8} color={color} />
      </View>
      <Text
        style={{
          fontFamily: focused ? 'Inter_600SemiBold' : 'Inter_500Medium',
          fontSize: 11,
          color,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FabSlot({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      // Equal flex slot — matches RegularTab's flex:1 so all 5 columns are
      // the same width and the FAB ends up exactly centered.
      style={{ flex: 1, alignItems: 'center' }}
    >
      <View
        style={[
          {
            position: 'absolute',
            top: -26,
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: colors.brand[500],
            borderWidth: 4,
            borderColor: colors.white,
            alignItems: 'center',
            justifyContent: 'center',
          },
          shadows.fab,
          Platform.OS === 'ios' ? null : { elevation: 12 },
        ]}
      >
        <Icon name="qr" size={26} stroke={2.2} color={colors.white} />
      </View>
      <View style={{ height: 40 }} />
      <Text
        style={{
          fontFamily: 'Inter_600SemiBold',
          fontSize: 11,
          color: colors.ink[500],
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
