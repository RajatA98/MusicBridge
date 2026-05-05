// MusicBridge — Sentry initialization (NFR-O1).
// Replaces Crashlytics per DECISIONS D2.13.

import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;
  if (!dsn) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[sentry] EXPO_PUBLIC_SENTRY_DSN not set — error monitoring disabled.');
    }
    return;
  }

  Sentry.init({
    dsn,
    debug: __DEV__,
    enableAutoSessionTracking: true,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    // Disable native crash reporting auto-init in dev to avoid log noise.
    enableNative: !__DEV__,
  });

  initialized = true;
}

export const captureError = Sentry.captureException;
export const captureMessage = Sentry.captureMessage;
