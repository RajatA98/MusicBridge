import { ExpoConfig, ConfigContext } from 'expo/config';

// MusicBridge Expo config.
// Universal Links + App Links wired here per DECISIONS.md D2.11.
// The actual associated domain (e.g., app.musicbridge.<tld>) is supplied via env at build time
// so dev/staging/prod can each point to the right host.

export default ({ config }: ConfigContext): ExpoConfig => {
  const associatedDomain = process.env.EXPO_PUBLIC_ASSOCIATED_DOMAIN ?? 'app.musicbridge.example';

  return {
    ...config,
    name: 'MusicBridge',
    slug: 'musicbridge',
    scheme: 'musicbridge',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#FFFFFF',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.musicbridge.app',
      // Universal Links (per D2.11). Do NOT include "https://".
      associatedDomains: [`applinks:${associatedDomain}`],
      infoPlist: {
        // MIDI background mode allows the app to keep MIDI session alive briefly when backgrounded.
        UIBackgroundModes: ['audio'],
        // Required for MIDI on iOS 14+.
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
        },
      },
    },
    android: {
      package: 'com.musicbridge.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      // App Links (per D2.11).
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: associatedDomain,
              pathPrefix: '/',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        '@sentry/react-native/expo',
        {
          // Sentry config — actual DSN provided via env at build time.
          organization: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      // Public Firebase config injected at build via EAS env.
      // These are NOT secrets — they're public-by-design web/native API keys.
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      associatedDomain,
    },
  };
};
