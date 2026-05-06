# MusicBridge

The delivery layer for piano home practice. A teacher writes what and how a student should
practice. The student opens the app and runs an AI-guided session that follows the teacher's
intent, with optional MIDI integration.

**v1 distribution:** Web (Firebase Hosting) primary + iOS Simulator / dev build for native testing. iPad is a first-class target.
**v2:** TestFlight production (gated on Apple Developer Program enrollment). Android v3+.

## Stack

- **App**: Expo SDK 53 + TypeScript + Expo Router + NativeWind 4.1.23
- **Backend**: Firebase Auth + Firestore + Cloud Functions Gen 2 + Firebase Hosting
- **AI**: Anthropic Claude Haiku 4.5 (server-side via Cloud Function only)
- **MIDI**: `@motiz88/react-native-midi` on iOS native, Web MIDI API on web
- **TTS**: `expo-speech` on native, `SpeechSynthesis` on web
- **Distribution**: EAS Build → TestFlight (internal). Web → Firebase Hosting.
- **Observability**: Sentry (client) + Cloud Functions structured logs

See `factory/artifacts/DECISIONS.md` for the full lock-in document.

## Getting started

### Prerequisites

- Node 22+
- A Firebase project with Auth + Firestore + Functions + Hosting enabled
- An Anthropic API key
- A Sentry project (optional in dev)
- For iOS: Apple Developer Program membership + Xcode

### First-time setup

```bash
# Install deps
npm install
cd functions && npm install && cd ..

# Configure env
cp .env.example .env.local
# Fill in EXPO_PUBLIC_FIREBASE_* values from Firebase Console

# Set the Cloud Functions secret (NOT in env files)
firebase functions:secrets:set ANTHROPIC_API_KEY

# Deploy Firestore rules + indexes
npm run deploy:rules

# Run the app
npm run web        # web build, http://localhost:19006
npm run ios        # iOS simulator (Expo dev client)
```

### Tests

```bash
npm run typecheck
npm run lint
npm run test              # unit tests
npm run test:rules        # Firestore rules emulator tests
```

### iOS Simulator dev build (v1 testing path)

For testing on iPad / iPhone simulators with full native module support
(MIDI, etc.) without an Apple Developer Program membership:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios --profile development --local   # ~10–15 min
# Drag the resulting .app into Xcode > Devices and Simulators, or:
xcrun simctl install booted path/to/MusicBridge.app
```

Then `npx expo start --dev-client` to connect the dev build to Metro.

### Deploy

```bash
# Web → Firebase Hosting
npm run deploy:hosting

# Cloud Functions
npm run deploy:functions

# iOS → TestFlight
eas build --platform ios --profile production
eas submit --platform ios
```

## Project structure

```
app/                  Expo Router routes (file-based)
  _layout.tsx         Root provider, auth state, Sentry init
  index.tsx           Role-based router
  login.tsx, signup.tsx
  teacher/            Teacher portal
  student/            Student app (incl. session view)
  invite/[code].tsx   Deep-link landing for invites

lib/                  Shared client code
  firebase.ts         Firebase wiring (auth + db + functions)
  auth-context.tsx    Auth + role state
  types.ts            Firestore document shapes
  tts.ts              TTS adapter (v1.5 ElevenLabs swap point)
  midi.ts             MIDI adapter wrapping vendored package
  sentry.ts           Sentry init

functions/            Firebase Cloud Functions
  src/index.ts        Entry point — exports callables
  src/generateSteps.ts  Phase 5: Claude-powered step generator

public/               Static assets copied to web export
  .well-known/        AASA + assetlinks (deep-link config)

factory/artifacts/    Project Factory artifacts (PROBLEM_SUMMARY, PRD, etc.)
brainlifts/           Source BrainLift documents
__tests__/            Jest tests (incl. Firestore rules)
```

## Operational notes

- **Firebase Hosting overrides AASA** with its old Dynamic Links default unless `appAssociation: "NONE"` is set in `firebase.json`. This is set. Do not remove.
- **Firebase Auth on native** must use `initializeAuth(...getReactNativePersistence(AsyncStorage))`. `getAuth()` silently degrades to memory persistence. See `lib/firebase.ts`.
- **Firebase Analytics is not initialized** anywhere in this codebase per COPPA requirements (DECISIONS D2.14).
