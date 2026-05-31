const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo run:android does not invoke the @react-native/community-cli-plugin that
// normally adds InitializeCore to getModulesRunBeforeMainModule. Without it,
// React Native's polyfills (FormData, Headers, AbortSignal, fetch, ...) are
// never registered on globalThis, crashing any module that references them.
config.serializer = {
  ...config.serializer,
  getModulesRunBeforeMainModule: () => [
    require.resolve('react-native/Libraries/Core/InitializeCore'),
  ],
};

module.exports = config;
