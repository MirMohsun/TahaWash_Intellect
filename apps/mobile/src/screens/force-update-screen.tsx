import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../components/brand/logo';
import { Button } from '../components/ui';
import { getStoreUrl } from '../lib/store-links';
import { colors } from '../theme/tokens';

interface ForceUpdateScreenProps {
  bundled: string;
  minimumVersion: string;
  latestVersion: string;
  releaseNotes: string | null;
}

/**
 * Full-screen blocker shown when the running app version is below the
 * server-configured `minimumVersion`. Cannot be dismissed — the only
 * action is "Update Now", which opens the App Store / Play Store via
 * Linking. Spec lock from round 5 (force-update yes).
 *
 * Why not a modal? RN modals can be dismissed by hardware back on
 * Android (and shouldn't be cancelable here). Rendering a full-screen
 * route gives us guaranteed blocking + lets the user still see the
 * brand instead of a black overlay. The root layout swaps this in
 * BEFORE rendering the Expo Router Stack — so there's no underlying
 * screen the user could glimpse.
 */
export function ForceUpdateScreen({
  bundled,
  minimumVersion,
  latestVersion,
  releaseNotes,
}: ForceUpdateScreenProps) {
  const { t } = useTranslation();

  const handleUpdatePress = async () => {
    const url = getStoreUrl();
    try {
      await Linking.openURL(url);
    } catch {
      // Linking.openURL throws if the URL can't be opened — should be
      // basically impossible for an https store URL on a real device.
      // No-op; the modal stays visible and the user can try again.
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <Logo size={88} />

          <Text
            style={{
              marginTop: 24,
              fontFamily: 'Inter_800ExtraBold',
              fontSize: 26,
              color: colors.ink[900],
              textAlign: 'center',
              letterSpacing: -0.6,
            }}
          >
            {t('forceUpdate.title')}
          </Text>

          <Text
            style={{
              marginTop: 12,
              fontFamily: 'Inter_400Regular',
              fontSize: 15,
              lineHeight: 22,
              color: colors.ink[500],
              textAlign: 'center',
            }}
          >
            {t('forceUpdate.body')}
          </Text>

          <View
            style={{
              marginTop: 28,
              alignSelf: 'stretch',
              backgroundColor: colors.bgElev,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 16,
              padding: 16,
              gap: 8,
            }}
          >
            <Row
              label={t('forceUpdate.installedVersion')}
              value={bundled}
              valueColor={colors.error}
            />
            <Row label={t('forceUpdate.minimumVersion')} value={minimumVersion} />
            <Row
              label={t('forceUpdate.latestVersion')}
              value={latestVersion}
              valueColor={colors.brand[600]}
            />
          </View>

          {releaseNotes ? (
            <View
              style={{
                marginTop: 16,
                alignSelf: 'stretch',
                backgroundColor: colors.bgElev,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 16,
                padding: 16,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 12,
                  letterSpacing: 0.8,
                  color: colors.ink[400],
                  marginBottom: 8,
                }}
              >
                {t('forceUpdate.whatsNew').toUpperCase()}
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter_400Regular',
                  fontSize: 14,
                  lineHeight: 20,
                  color: colors.ink[700],
                }}
              >
                {releaseNotes}
              </Text>
            </View>
          ) : null}

          <View style={{ marginTop: 32, alignSelf: 'stretch' }}>
            <Button full onPress={handleUpdatePress}>
              {t('forceUpdate.updateNow')}
            </Button>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.ink[500] }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: 'Inter_700Bold',
          fontSize: 14,
          color: valueColor ?? colors.ink[900],
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}
