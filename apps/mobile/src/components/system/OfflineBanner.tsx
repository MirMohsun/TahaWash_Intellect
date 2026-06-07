import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../ui/Icon';
import { colors } from '../../theme/tokens';

/**
 * A10.3 Offline fallback — thin top-of-screen banner.
 *
 * Subscribes to NetInfo. When the device has no usable connectivity
 * (no network OR network reports `isInternetReachable === false`)
 * we render a 32pt amber banner above the safe area inset.
 *
 * Implementation note: the visible offline state isn't perfectly
 * accurate on every device (iOS sometimes reports `isInternetReachable
 * === null` for several seconds after reconnect). We treat `null` as
 * "still online" so the banner doesn't flicker — it only hides false-
 * negatives, never false-positives.
 *
 * Mounted globally in app/_layout.tsx so every route gets it.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable is null while NetInfo is still probing —
      // don't show the banner on that "unknown" state.
      const reachable =
        state.isInternetReachable === null ? true : state.isInternetReachable === true;
      const connected = state.isConnected === true;
      setOffline(!connected || !reachable);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  if (!offline) return null;

  return (
    <View
      style={{
        backgroundColor: colors.amberSoft,
        paddingTop: insets.top + 4,
        paddingBottom: 8,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.amber,
      }}
      pointerEvents="none"
    >
      <Icon name="alert" size={16} color={colors.amber} />
      <Text
        style={{
          fontFamily: 'Inter_600SemiBold',
          fontSize: 13,
          color: colors.amber,
        }}
      >
        {t('system.offlineBanner')}
      </Text>
    </View>
  );
}
