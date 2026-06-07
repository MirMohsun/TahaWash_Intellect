import { Stack } from 'expo-router';

/**
 * Auth flow stack. Headers off because every auth screen uses its own
 * back button + custom header (per the locked design).
 *
 * Routes inside this group:
 *   /phone       → A1.2 phone entry
 *   /otp         → A1.3 OTP entry (passes ?phone= via search params)
 *   /permissions → A1.4 + A1.5 combined permission asks
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F6F7F8' },
      }}
    />
  );
}
