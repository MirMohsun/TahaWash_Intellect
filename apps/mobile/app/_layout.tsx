import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/global.css';
import '../src/i18n';
import { DialogProvider } from '../src/components/ui';
import { ErrorBoundary } from '../src/components/system/ErrorBoundary';
import { OfflineBanner } from '../src/components/system/OfflineBanner';
import { useAppBootstrap } from '../src/hooks/use-app-bootstrap';
import { queryClient } from '../src/lib/query-client';
import { ForceUpdateScreen } from '../src/screens/force-update-screen';

// Keep the splash visible until fonts AND version check are settled —
// prevents the system-font flash AND a "real screen then suddenly
// force-update modal" flicker.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already prevented or the platform doesn't support it — nothing to do.
});

/**
 * Root layout — wraps every screen.
 *
 * Bootstrap order (see useAppBootstrap):
 *   1. Load Inter (blocking)
 *   2. GET /public/version — classify against bundled version
 *   3. Hide splash once BOTH settled
 *   4. If force-update is required, render the blocker INSTEAD of the
 *      Stack — user can't reach any other route from here.
 *   5. Otherwise render the normal Expo Router Stack.
 *
 * Provider tree order:
 *   GestureHandlerRootView → required by react-native-gesture-handler
 *   SafeAreaProvider       → required for useSafeAreaInsets in children
 *   StatusBar              → default dark style (per-screen overrides later)
 */
export default function RootLayout() {
  const bootstrap = useAppBootstrap();

  useEffect(() => {
    if (bootstrap.phase !== 'loading') {
      SplashScreen.hideAsync().catch(() => {
        /* already hidden */
      });
    }
  }, [bootstrap.phase]);

  if (bootstrap.phase === 'loading') {
    // Native splash is still up; render nothing.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <ErrorBoundary>
            <DialogProvider>
              <View style={{ flex: 1 }}>
                <OfflineBanner />
                {bootstrap.phase === 'force-update' ? (
                <ForceUpdateScreen
                  bundled={bootstrap.version.bundled}
                  minimumVersion={bootstrap.version.minimumVersion}
                  latestVersion={bootstrap.version.latestVersion}
                  releaseNotes={bootstrap.version.releaseNotes}
                />
              ) : (
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: '#F6F7F8' },
                  }}
                />
              )}
              </View>
            </DialogProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
