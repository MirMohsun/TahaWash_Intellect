import type { ExpoConfig } from 'expo/config';

/**
 * Tahawash mobile — Expo configuration.
 *
 * Locked product decisions reflected here:
 * - portrait-only orientation (spec)
 * - iOS + Android only
 * - bundle ids reserved for future store submission
 * - light theme only (no dark mode in MVP)
 */
const config: ExpoConfig = {
  name: 'Tahawash',
  slug: 'tahawash',
  // Owner is the Expo/EAS account that owns this project. Set to the
  // user's organization (which has the premium plan) so EAS Build runs
  // under that account's billing + quota.
  owner: 'bobbychavess-organization',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/logo/logo_app.png',
  scheme: 'tahawash',
  userInterfaceStyle: 'light',
  // @rnmapbox/maps@10.1.39's Android ViewManagers (RNMBXPointAnnotationManager
  // et al.) implement codegen-generated interfaces from
  // `com.facebook.react.viewmanagers.RNMBX*ManagerInterface`. Those interfaces
  // only exist when React Native's codegen pipeline runs — which requires the
  // New Architecture. With newArchEnabled=false the Kotlin compile fails:
  //   "unresolved supertypes: ViewManagerWithGeneratedInterface"
  //
  // The previous expo-modules-core 'components.release' Gradle failure is
  // independently handled by patches/expo-modules-core@2.2.3.patch (null-safe
  // findByName), so enabling New Arch here is now safe.
  newArchEnabled: true,
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FAFEFF',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'az.tahawash.app',
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      NSCameraUsageDescription: 'Tahawash needs camera access to scan QR codes on wash bays.',
      NSLocationWhenInUseUsageDescription:
        'Tahawash uses your location to show nearby carwashes on the map.',
      // Lets Linking.canOpenURL detect these map apps so the "Get directions"
      // action sheet only lists the ones actually installed.
      LSApplicationQueriesSchemes: ['comgooglemaps', 'waze'],
    },
  },
  android: {
    package: 'az.tahawash.app',
    // Firebase config (FCM project tahawash-6d614). Embeds the FCM
    // sender id / app id into the build so the device can register for
    // a push token. WITHOUT this, getExpoPushTokenAsync throws on a
    // standalone APK and no token is ever saved → Recipients stays 0.
    // Must be committed — EAS cloud builds only include git-tracked files.
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/logo/logo_app.png',
      backgroundColor: '#0260f9',
    },
    permissions: ['CAMERA', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    'expo-splash-screen',
    // Configures the native push module (Android notification icon/color).
    // Required so FCM-delivered pushes render with a proper small icon
    // instead of a blank square on Android 8+.
    [
      'expo-notifications',
      {
        color: '#0E7AE7',
      },
    ],
    [
      // Native Mapbox bindings for the Wash-tab map. The download token is
      // read from `process.env.MAPBOX_DOWNLOAD_TOKEN` at BUILD TIME on the
      // EAS Build server (set via `eas secret:create MAPBOX_DOWNLOAD_TOKEN`).
      // Locally the var is unset; that's fine — local builds (if attempted)
      // would fail at the Mapbox SDK download step, but EAS builds succeed.
      //
      // The RUNTIME token (`EXPO_PUBLIC_MAPBOX_TOKEN`, public `pk.`) is set
      // separately via eas.json's `env` block per build profile.
      '@rnmapbox/maps',
      {
        RNMapboxMapsImpl: 'mapbox',
        RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOAD_TOKEN,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      // Owned by @bobbychavess-organization (premium-plan account).
      // Project URL:
      //   https://expo.dev/accounts/bobbychavess-organization/projects/tahawash
      projectId: '530faa1b-35dd-44e8-a1cb-4c17251bb57b',
    },
  },
};

export default config;
