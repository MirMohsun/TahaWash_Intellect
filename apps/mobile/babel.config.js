// Tahawash mobile — Babel config
//
// `babel-preset-expo` handles Expo + React Native transforms.
// `jsxImportSource: nativewind` enables NativeWind v4's `className` prop.
// `react-native-reanimated/plugin` must be LAST in the plugin list.

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxImportSource: 'nativewind',
        },
      ],
      'nativewind/babel',
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
