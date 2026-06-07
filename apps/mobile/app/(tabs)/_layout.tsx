import { Tabs } from 'expo-router';
import { TabBar } from '../../src/components/navigation/TabBar';
import { usePushRegistration } from '../../src/hooks/use-push-registration';

/**
 * Authenticated app shell — bottom-nav with raised Scan FAB.
 *
 * Routes inside (tabs)/ map to tab names in TabBar's TAB_ORDER.
 * Scan is rendered as a raised FAB but is NOT a tab — tapping it
 * pushes /scanner (a route outside this group). The TabBar handles
 * that separately so we don't need a corresponding tab file here.
 *
 * usePushRegistration runs once on mount AFTER the auth gate has
 * landed the user here — that's the natural place to register the
 * device's push token with the backend (Phase 2.12). Mounting it in
 * this layout means cold-boot-authed AND post-OTP-permission flows
 * both get covered without duplicating the call.
 */
export default function TabsLayout() {
  usePushRegistration();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // `position: 'absolute'` is the key: it tells the navigator NOT to
        // reserve a layout row for the tab bar, so each scene fills the full
        // height and our floating island OVERLAYS the screen content. Without
        // it the bar sat in an in-flow row whose (opaque navigator) background
        // showed through our transparent bar as a full-width slab behind the
        // island. The rest just strips any chrome the wrapper would paint.
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    />
  );
}
