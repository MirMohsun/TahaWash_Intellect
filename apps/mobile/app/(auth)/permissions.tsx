import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon } from '../../src/components/ui';
import { colors, gradients } from '../../src/theme/tokens';

/**
 * A1.4 + A1.5 combined permissions screen.
 *
 * Soft-ask cards for notifications + location, each with a gently pulsing
 * "Allow" CTA that nudges the user to grant. Neither is required.
 *
 * Robust state handling:
 *   - On mount we read the REAL OS permission state, so a returning user who
 *     already granted one (or both) sees the correct per-card state — no stale
 *     "Allow" button on something that's already on.
 *   - Returning users with BOTH already granted never even reach this screen:
 *     the OTP step skips straight to the app (see app/(auth)/otp.tsx).
 *   - A previously DENIED permission can't be re-prompted by the OS, so its
 *     card switches to an "Open Settings" action.
 */

type PermStatus = 'idle' | 'granted' | 'denied';

function mapStatus(status: string): PermStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'idle';
}

export default function PermissionsScreen() {
  const { t } = useTranslation();
  const [notifStatus, setNotifStatus] = useState<PermStatus>('idle');
  const [locStatus, setLocStatus] = useState<PermStatus>('idle');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [loc, notif] = await Promise.all([
          Location.getForegroundPermissionsAsync(),
          Notifications.getPermissionsAsync(),
        ]);
        if (!active) return;
        setLocStatus(mapStatus(loc.status));
        setNotifStatus(mapStatus((notif as unknown as { status: string }).status));
      } catch {
        /* leave idle */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const askNotifications = async () => {
    // expo-notifications' PermissionResponse type doesn't resolve cleanly in
    // SDK 52, so read the always-present `status` via a cast.
    const result = (await Notifications.requestPermissionsAsync()) as unknown as { status: string };
    setNotifStatus(result.status === 'granted' ? 'granted' : 'denied');
  };

  const askLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocStatus(status === 'granted' ? 'granted' : 'denied');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 24 }}>
        <Text
          style={{
            fontFamily: 'Inter_800ExtraBold',
            fontSize: 30,
            lineHeight: 34,
            letterSpacing: -1,
            color: colors.ink[900],
            marginTop: 24,
          }}
        >
          {t('auth.permissions.title')}
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 16,
            lineHeight: 23,
            color: colors.ink[500],
            marginTop: 8,
            marginBottom: 28,
          }}
        >
          {t('auth.permissions.subtitle')}
        </Text>

        <PermissionRow
          iconName="bell"
          title={t('auth.permissions.notifTitle')}
          body={t('auth.permissions.notifBody')}
          status={notifStatus}
          onAsk={askNotifications}
          ctaLabel={t('auth.permissions.notifCta')}
        />

        <View style={{ height: 14 }} />

        <PermissionRow
          iconName="mapPin"
          title={t('auth.permissions.locTitle')}
          body={t('auth.permissions.locBody')}
          status={locStatus}
          onAsk={askLocation}
          ctaLabel={t('auth.permissions.locCta')}
        />
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
        <Button full onPress={() => router.replace('/')}>
          {t('common.continue')}
        </Button>
        <Text
          style={{
            marginTop: 8,
            textAlign: 'center',
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            color: colors.ink[400],
          }}
        >
          {t('auth.permissions.changeLater')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

interface PermissionRowProps {
  iconName: 'bell' | 'mapPin';
  title: string;
  body: string;
  status: PermStatus;
  onAsk: () => void;
  ctaLabel: string;
}

function PermissionRow({ iconName, title, body, status, onAsk, ctaLabel }: PermissionRowProps) {
  const { t } = useTranslation();
  const granted = status === 'granted';
  const denied = status === 'denied';

  // Gentle "breathing" pulse on the Allow CTA while the permission is still
  // pending — draws the eye without being noisy. Native driver (transform
  // only) so it stays smooth; stops the moment the permission resolves.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (status !== 'idle') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 850, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });

  return (
    <View
      style={{
        backgroundColor: colors.bgElev,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: granted ? colors.successSoft : colors.line,
        padding: 16,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <LinearGradient
          colors={gradients.avatar as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={iconName} size={24} color={colors.white} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 16,
              letterSpacing: -0.2,
              color: colors.ink[900],
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              marginTop: 3,
              fontFamily: 'Inter_400Regular',
              fontSize: 13,
              lineHeight: 19,
              color: colors.ink[500],
            }}
          >
            {body}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 14 }}>
        {granted ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 44,
              borderRadius: 999,
              backgroundColor: colors.successSoft,
            }}
          >
            <Icon name="check" size={18} color={colors.success} />
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.success }}>
              {t('auth.permissions.granted')}
            </Text>
          </View>
        ) : denied ? (
          <Button variant="outline" full onPress={() => void Linking.openSettings()}>
            {t('auth.permissions.openSettings', { defaultValue: 'Open Settings' })}
          </Button>
        ) : (
          <Animated.View style={{ transform: [{ scale }] }}>
            <Button full onPress={onAsk}>
              {ctaLabel}
            </Button>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
