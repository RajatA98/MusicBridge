// MusicBridge — Firebase client wiring.
// Locked per DECISIONS.md D2.2, D2.3.
//
// Critical: on native, MUST use initializeAuth with getReactNativePersistence(AsyncStorage).
// Plain getAuth() silently degrades to memory persistence — TS types are wrong, no runtime warning.
// (See D2.3 critical gotcha and `.research-best-practices.md`.)

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  // @ts-expect-error — getReactNativePersistence is exported but not typed in firebase v12 (known TS bug).
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';

const extra = Constants.expoConfig?.extra ?? {};

const firebaseConfig = {
  apiKey: extra.firebaseApiKey as string | undefined,
  authDomain: extra.firebaseAuthDomain as string | undefined,
  projectId: extra.firebaseProjectId as string | undefined,
  storageBucket: extra.firebaseStorageBucket as string | undefined,
  messagingSenderId: extra.firebaseMessagingSenderId as string | undefined,
  appId: extra.firebaseAppId as string | undefined,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  // Fail loud at startup if config is missing rather than silently in random places later.
  // Surface this in dev; in prod, Sentry will catch the resulting downstream errors.
  // eslint-disable-next-line no-console
  console.warn(
    '[firebase] Missing EXPO_PUBLIC_FIREBASE_* env. Auth and Firestore calls will fail.',
  );
}

let app: FirebaseApp;
const existing = getApps();
if (existing.length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  // existing[0] is guaranteed non-null because length > 0.
  app = existing[0] as FirebaseApp;
}

let _auth: Auth;
if (Platform.OS === 'web') {
  // Web: default origin-scoped local persistence.
  _auth = getAuth(app);
} else {
  // Native: explicit AsyncStorage persistence. Required.
  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export const auth: Auth = _auth;
export const db: Firestore = getFirestore(app);
export const functions: Functions = getFunctions(app, 'us-central1');

// Callable references — created at module load so they share the same Functions instance.
// Per DECISIONS.md D2.7: generateSteps is the only AI function in v1.
export const generateStepsCallable = httpsCallable<
  { assignmentId: string },
  GenerateStepsResponse
>(functions, 'generateSteps');

export type GenerateStepsResponse =
  | { steps: string[]; fallback: false; modelUsed: string }
  | { steps: null; fallback: true; body: string; reason: string };

export { app };
