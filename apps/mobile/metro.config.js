// Tahawash mobile — Metro bundler config
//
// Configured for pnpm monorepo:
// - Watch the monorepo root so changes in `packages/*` trigger reload
// - Resolve modules through both the app's own node_modules AND the
//   workspace root's node_modules (pnpm hoists shared deps there)
// - NativeWind v4 wrapper applied last for Tailwind class processing
//
// References:
//   https://docs.expo.dev/guides/monorepos/
//   https://www.nativewind.dev/getting-started/expo-router

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the monorepo root for changes in shared packages
config.watchFolders = [monorepoRoot];

// 2. Resolve modules from both the app and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Make Metro resolve symlinks (needed with pnpm)
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

// 4. Apply NativeWind transformer (must be last)
module.exports = withNativeWind(config, {
  input: './src/global.css',
});
