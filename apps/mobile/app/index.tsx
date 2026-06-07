import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useIntroState } from '../src/hooks/use-intro-state';
import { useAuthStore } from '../src/store/auth';
import { colors } from '../src/theme/tokens';

/**
 * Auth + intro gate. Reads the auth Zustand store + the SecureStore-
 * backed intro-seen flag, and redirects accordingly:
 *
 *   status='unknown'           → spinner (auth not hydrated yet, <50ms)
 *   intro='unknown'            → spinner (SecureStore read in flight, <50ms)
 *   status='unauth' + 'unseen' → /intro (first-launch onboarding carousel)
 *   status='unauth' + 'seen'   → /(auth)/phone
 *   status='authed'            → /(tabs)/main
 *
 * Already-authenticated users NEVER see the intro — they've completed
 * onboarding before. The intro screen is the only entry that writes the
 * SecureStore flag (via markIntroSeen on finish OR skip).
 *
 * This component runs AFTER _layout has cleared the bootstrap gate
 * (fonts loaded + version check settled), so we don't gate on those.
 */
export default function Index() {
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);
  const intro = useIntroState();

  useEffect(() => {
    if (status === 'unknown') {
      void hydrate();
    }
  }, [status, hydrate]);

  if (status === 'unknown' || intro === 'unknown') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.brand[500]} />
      </View>
    );
  }

  if (status === 'unauth') {
    return intro === 'unseen' ? <Redirect href="/intro" /> : <Redirect href="/(auth)/phone" />;
  }

  return <Redirect href="/(tabs)/main" />;
}
