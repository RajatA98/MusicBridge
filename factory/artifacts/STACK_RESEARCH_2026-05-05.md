# MusicBridge Stack Research

**Status:** Complete  
**Last Updated:** 2026-05-05  
**Scope:** 2026 production best practices research for the current MusicBridge stack and product shape  
**Artifacts reread before research:** `PROBLEM_SUMMARY.md`, `PRESEARCH.md`, `PRD.md`

## Context snapshot

Current artifact set points to:

- Expo universal app
- iOS native + web in v1, Android in v2
- Firebase Auth + Firestore + Cloud Functions Gen 2 + Hosting
- Thin checklist AI tutor in v1
- Native iOS MIDI + web MIDI where available
- TestFlight for iOS distribution

One verified mismatch in the requested locked stack:

- I could **not** verify any Anthropic model published as `Claude Haiku 4.5` on **2026-05-05**.
- The currently documented Haiku production pin I could verify is `claude-3-5-haiku-20241022`.
- Recommendation below reflects only what I could verify from Anthropic docs.

## 1. Expo + Firebase production wiring in 2026

**Recommendation:** Use the **Firebase JS SDK** for Auth, Firestore, and callable Functions in the Expo app. Only add `@react-native-firebase/*` if you later need native-only services like Crashlytics.

```ts
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const app = initializeApp(firebaseConfig);

export const auth =
  Platform.OS === 'web'
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });

export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
export const generateSteps = httpsCallable(functions, 'generateSteps');
```

**Gotchas:**

- On native, do not rely on bare `getAuth(app)` if you care about persistence. Use `initializeAuth(...getReactNativePersistence(AsyncStorage))`.
- On web, Auth persistence is origin-scoped and defaults to local persistence.
- Best Admin SDK access pattern is a **2nd gen callable function** invoked by the authenticated Expo client. Callable Functions automatically include Auth and App Check tokens when available.

**Sources:**

- https://docs.expo.dev/guides/using-firebase/
- https://firebase.google.com/docs/reference/js/auth
- https://firebase.google.com/docs/auth/web/auth-state-persistence
- https://firebase.google.com/docs/functions/callable

## 2. Firestore data modeling for teacher-student-assignment-session

**Recommendation:** Keep **single root collections**: `users`, `invites`, `assignments`, `sessions`. It matches the current PRD, keeps v1 queries simple, and avoids collection-group complexity you do not need yet.

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function userDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function isTeacher() {
      return signedIn() && userDoc().data.role == 'teacher';
    }

    match /users/{uid} {
      allow create, read, update: if signedIn() && request.auth.uid == uid;
    }

    match /assignments/{assignmentId} {
      allow read: if signedIn() && (
        resource.data.studentId == request.auth.uid ||
        (isTeacher() && resource.data.teacherId == request.auth.uid)
      );

      allow create: if isTeacher()
        && request.resource.data.teacherId == request.auth.uid;

      allow update, delete: if isTeacher()
        && resource.data.teacherId == request.auth.uid;
    }

    match /sessions/{sessionId} {
      allow read: if signedIn() && (
        resource.data.studentId == request.auth.uid ||
        (isTeacher() && resource.data.teacherId == request.auth.uid)
      );

      allow create, update: if signedIn() && (
        request.resource.data.studentId == request.auth.uid ||
        (isTeacher() && request.resource.data.teacherId == request.auth.uid)
      );
    }

    match /invites/{code} {
      allow create, update: if isTeacher()
        && request.resource.data.teacherId == request.auth.uid;
      allow read: if signedIn();
    }
  }
}
```

**Indexes to create now:**

- `assignments(studentId ASC, createdAt DESC)`
- `assignments(teacherId ASC, studentId ASC, createdAt DESC)`
- `sessions(assignmentId ASC, startedAt DESC)` if you show session history per assignment

**Gotchas:**

- Firestore rules are **not filters**. Queries must already satisfy the rule shape or the whole query fails.
- Server SDKs bypass Security Rules, so Admin SDK code is part of your privacy boundary.

**Sources:**

- https://firebase.google.com/docs/firestore/security/get-started
- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://firebase.google.com/docs/firestore/security/rules-query
- https://firebase.google.com/docs/firestore/query-data/indexing

## 3. Cloud Function calling Claude API

**Recommendation:** Use a **single-shot callable Function** for 3 to 7 step generation. Do not stream for this use case. Set a short timeout, one warm instance, and bounded retry on Anthropic-side failures.

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const generateSteps = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 30,
    minInstances: 1,
    concurrency: 20,
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign-in required');
    }

    // Call Anthropic with a pinned model ID here.
    // If generation fails, return a graceful fallback payload.
  }
);
```

**Fallback policy:**

- `429`: honor `retry-after`, single retry with jitter
- `500` and `529`: one bounded retry with jitter
- failure after retry: return raw teacher text and mark session as fallback mode

**Gotchas:**

- I could not verify `Haiku 4.5`. Verified production pin as of 2026-05-05: `claude-3-5-haiku-20241022`.
- Anthropic recommends pinned model IDs in production instead of aliases.
- `minInstances` reduces cold starts. Concurrency behavior depends on available CPU in Gen 2.

**Sources:**

- https://docs.anthropic.com/en/docs/about-claude/models/overview
- https://docs.anthropic.com/en/api/errors
- https://docs.anthropic.com/en/api/rate-limits
- https://firebase.google.com/docs/functions/callable
- https://firebase.google.com/docs/functions/manage-functions

## 4. iOS Universal Links via Expo Router

**Recommendation:** Configure `associatedDomains` in `app.config.ts`, host a real AASA file from Firebase Hosting, and treat the website as the install-time fallback. Universal Links do **not** provide deferred deep linking by themselves.

```ts
// app.config.ts
export default {
  expo: {
    ios: {
      associatedDomains: ['applinks:app.musicbridge.example'],
    },
    android: {
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: 'app.musicbridge.example', pathPrefix: '/' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  },
};
```

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "ABCDE12345.com.musicbridge.app",
        "paths": ["/invite/*", "/practice/*"]
      }
    ]
  },
  "activitycontinuation": {
    "apps": ["ABCDE12345.com.musicbridge.app"]
  },
  "webcredentials": {
    "apps": ["ABCDE12345.com.musicbridge.app"]
  }
}
```

```json
{
  "hosting": {
    "public": "dist",
    "headers": [
      {
        "source": "/.well-known/apple-app-site-association",
        "headers": [{ "key": "Content-Type", "value": "application/json" }]
      },
      {
        "source": "/.well-known/assetlinks.json",
        "headers": [{ "key": "Content-Type", "value": "application/json" }]
      }
    ]
  }
}
```

**Deferred deep linking recommendation for v1:**

- Use a web invite landing page that owns the invite token.
- If the app is installed, open the app via Universal Link.
- If not installed, complete install/signup from the website and keep the invite token server-side so the app can recover state after login.

**Gotchas:**

- Do not include `https://` in `associatedDomains`.
- Apple re-fetches AASA on install/update boundaries, so path mistakes can appear sticky during testing.

**Sources:**

- https://docs.expo.dev/linking/ios-universal-links/
- https://docs.expo.dev/linking/overview/
- https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content
- https://firebase.google.com/docs/hosting/full-config
- https://developer.android.com/training/app-links

## 5. NativeWind v4 in Expo SDK 55

**Recommendation:** Use **NativeWind 4.1.23** with Expo SDK 55 and keep the setup minimal. Use one `global.css`, correct content globs, and do not assume full web CSS semantics on native.

```css
/* global.css */
@import "tailwindcss";
```

```ts
// app entry
import './global.css';
```

**Best-practice pattern:**

- Keep `global.css` minimal
- Prefer classes on RN primitives rather than elaborate CSS indirection
- Pin NativeWind to the Expo-supported package set for your SDK version

**Gotchas:**

- NativeWind documents RN/web differences around `color`, `flex`, and `flex-direction`.
- There was a verified Expo SDK 54 / React 19 NativeWind `ref` regression. Do not freehand upgrades across Expo/React/NativeWind versions.

**Sources:**

- https://www.nativewind.dev/docs/getting-started/installation
- https://www.nativewind.dev/docs/getting-started/troubleshooting
- https://www.npmjs.com/package/nativewind
- https://github.com/expo/expo/issues/39657

## 6. `@motiz88/react-native-midi` production readiness

**Recommendation:** Treat `@motiz88/react-native-midi@0.0.6` as **unverified for Expo SDK 55** until you prove it on your exact build matrix. Vendor and patch it immediately if you keep it. If it fails, replace it with a small custom Expo Module wrapping the Core MIDI calls you actually need.

```ts
import { requestMIDIAccess } from '@motiz88/react-native-midi';

const midi = await requestMIDIAccess();
```

**Best fallback path:**

- Try vendored package first
- If build/runtime instability appears, switch to custom Expo Module for:
  - enumerate devices
  - connect input
  - receive note events

**Gotchas:**

- npm page says the package is experimental
- repo is marked WIP
- I could not verify an official compatibility claim for current Expo SDK / RN versions

**Sources:**

- https://www.npmjs.com/package/%40motiz88/react-native-midi
- https://github.com/motiz88/react-native-midi

## 7. iOS speech synthesis via React Native

**Recommendation:** Use **`expo-speech`** for v1, not `react-native-tts`. It is current, bundled with the latest Expo SDK docs, and covers iOS plus web in one API surface.

```ts
import * as Speech from 'expo-speech';

Speech.speak(text, {
  voice,
  rate: 1.0,
  onDone: () => {},
  useApplicationAudioSession: false,
});
```

**Web handling to plan for:**

- voices load asynchronously, so wait for `speechSynthesis.getVoices()` to populate
- do not depend on boundary timing events for core UX

**Gotchas:**

- Expo documents that `expo-speech` is silent on physical iOS devices when the hardware silent switch is on.
- `react-native-tts` appears stale compared with `expo-speech`.

**Sources:**

- https://docs.expo.dev/versions/latest/sdk/speech/
- https://www.npmjs.com/package/expo-speech
- https://www.npmjs.com/package/react-native-tts
- https://developer.apple.com/documentation/avfaudio/avspeechsynthesizer/usesapplicationaudiosession
- https://developer.apple.com/documentation/avfaudio/avspeechsynthesisvoice/quality
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/boundary_event

## 8. K-12 ed-tech privacy patterns

**Recommendation:** If v1 depends on “teacher attests student is 13+,” make that a **required teacher action recorded as an immutable audit event**, not just a checkbox. Store attestation timestamp, teacher ID, student email, and terms version in a write-once record.

```ts
// invite_audits/{id}
{
  teacherId,
  studentEmail,
  attestedOver13: true,
  attestedAt: serverTimestamp(),
  termsVersion: "2026-05-05"
}
```

**Production-grade floor:**

- teacher-facing attestation field in invite flow
- immutable Firestore audit record
- explicit retention/deletion language
- documented delete path for invites, sessions, and account-linked data

**Gotchas:**

- COPPA generally requires parental consent before collecting personal information from children under 13.
- Firebase server SDKs bypass Security Rules, so Functions/Admin code must be treated as part of the privacy perimeter.

**Sources:**

- https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- https://studentprivacy.ed.gov/audience/education-technology-vendors
- https://studentprivacy.ed.gov/privacy-and-data-sharing
- https://studentprivacy.ed.gov/resources/identity-authentication-best-practices
- https://studentprivacy.ed.gov/resources/best-practices-data-destruction
- https://firebase.google.com/docs/firestore/security/get-started

## 9. TestFlight distribution for Expo iOS app via EAS Build

**Recommendation:** Use **EAS Build production build + EAS Submit**. Start with internal testers, then move to external testers after the install, auth, and deep-link flows are stable.

```json
{
  "build": {
    "production": {
      "ios": {
        "simulator": false
      }
    }
  }
}
```

```bash
eas build --platform ios
eas submit --platform ios
# or
eas build --platform ios --auto-submit
```

**Gotchas:**

- Apple allows up to 100 internal testers and up to 10,000 external testers.
- External TestFlight requires beta app review.
- Public-link external testers can appear anonymous in App Store Connect.

**Sources:**

- https://docs.expo.dev/build/introduction/
- https://docs.expo.dev/submit/introduction/
- https://docs.expo.dev/tutorial/eas/ios-production-build/
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers

## 10. Observability minimum for v1

**Recommendation:** The smallest production-acceptable setup is **Sentry in the Expo client + Cloud Logging for Functions**. Do not stop at Functions logs only; TestFlight users need client crash visibility.

```bash
npx @sentry/wizard@latest -i reactNative
```

**Recommended floor for 50 testers max:**

- Sentry in Expo app
- structured Cloud Functions logs
- App Check on callable Functions if abuse appears

**Gotchas:**

- If you later use EAS Update, upload source maps or client traces become much less useful.
- Crashlytics would push you toward native Firebase modules. That is valid later, but it is not the lightest v1 floor for this stack.

**Sources:**

- https://docs.expo.dev/guides/using-sentry/
- https://docs.expo.dev/guides/using-firebase/
- https://firebase.google.com/docs/crashlytics/
- https://firebase.google.com/docs/app-check/cloud-functions

## Bottom line

For the current MusicBridge v1:

- use Expo SDK 55-era universal app patterns
- keep Firebase on the JS SDK path in the app
- keep Firestore flat and rule-driven
- use callable Gen 2 Functions for AI
- treat Universal Links as install-time routing, not deferred deep linking
- use `expo-speech` for v1 TTS
- treat `@motiz88/react-native-midi` as risky until proven on your exact build
- record 13+ teacher attestation as auditable data
- ship through EAS Build + TestFlight
- add Sentry before inviting real testers

