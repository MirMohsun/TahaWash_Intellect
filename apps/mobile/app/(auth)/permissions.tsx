import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Icon } from '../../src/components/ui';
import { colors } from '../../src/theme/tokens';

/**
 * A1.4 + A1.5 combined permissions screen (derived — not in the 10
 * locked hi-fi designs but flagged "derive from existing patterns"
 * in DESIGN_SYSTEM_LOCKED.md).
 *
 * Shows soft-ask explanations for notifications + location, then lets
 * the user tap each to trigger the native OS prompt. Neither is
 * required — both have "Skip for now" semantics, and the user can
 * grant later from Profile (Phase 2.10).
 *
 * After both have been resolved (granted or denied) we navigate to /,
 * which goes through the Phase 2.4 bottom-nav shell once that lands.
 * For now / is still the design catalog from Phase 2.1 — replaced soon.
 */
export default function PermissionsScreen() {
  const { t } = useTranslation();
  const [notifStatus, setNotifStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [locStatus, setLocStatus] = useState<'idle' | 'granted' | 'denied'>('idle');

  const askNotifications = async () => {
    // expo-notifications types in SDK 52 are slightly broken (its
    // PermissionResponse import from expo doesn't resolve here), so we
    // cast through unknown to read the status field that's always
    // present at runtime.
    const result = (await Notifications.requestPermissionsAsync()) as unknown as {
      status: string;
    };
    setNotifStatus(result.status === 'granted' ? 'granted' : 'denied');
  };

  const askLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocStatus(status === 'granted' ? 'granted' : 'denied');
  };

  const handleContinue = () => {
    router.replace('/');
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

        <View style={{ height: 12 }} />

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
        <Button full onPress={handleContinue}>
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
  status: 'idle' | 'granted' | 'denied';
  onAsk: () => void;
  ctaLabel: string;
}

function PermissionRow({ iconName, title, body, status, onAsk, ctaLabel }: PermissionRowProps) {
  const { t } = useTranslation();
  const resolved = status !== 'idle';
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.brand[50],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={iconName} size={22} color={colors.brand[600]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 16,
              color: colors.ink[900],
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              marginTop: 4,
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
      <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center' }}>
        {resolved ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon
              name={status === 'granted' ? 'check' : 'close'}
              size={16}
              color={status === 'granted' ? colors.success : colors.ink[400]}
            />
            <Text
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 13,
                color: status === 'granted' ? colors.success : colors.ink[400],
              }}
            >
              {status === 'granted' ? t('auth.permissions.granted') : t('auth.permissions.denied')}
            </Text>
          </View>
        ) : (
          <Button variant="outline" size="sm" onPress={onAsk}>
            {ctaLabel}
          </Button>
        )}
      </View>
    </Card>
  );
}
