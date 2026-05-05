# Decisions: MusicBridge

**Status:** Complete
**Last Updated:** 2026-05-05
**Sources:** `PROBLEM_SUMMARY.md`, `PRD.md`, `PRESEARCH.md`, `STACK_RESEARCH_2026-05-05.md`, `.research-best-practices.md`, `.research-midi.md`, `.research-stack.md`

This document locks in product behavior, tech stack, architecture patterns, and operational floors for v1. Once approved, treat all entries as fixed during implementation. Open items at the bottom.

---

## Part 1 — Product behavior decisions

### D1.1 Session walkthrough (CL-1 locked)
- Student taps an assignment on dashboard → lands on session view.
- Header shows teacher name; quote-styled box shows teacher's exact assignment text verbatim.
- Optional MIDI connect via iOS native picker (Core MIDI) or Web MIDI on desktop browsers.
- Tap **Start** → ~3s loading state while Cloud Function generates a 3–7 step checklist via Claude.
- Steps shown one at a time. Progress dots at top.
- Step text auto-plays as TTS audio on first display. Replay button (↻) available.
- Live MIDI display below step text when connected: last 4 notes played, color-coded.
- Bottom button: "Done with this step" (single tap). No auto-advance, no time pressure.
- Final screen: "Session complete. Maya will see this when you next see her." → back to dashboard.

### D1.2 Tutor tone (CL-2 locked)
- **Direct coach** voice + **patient explainer** for the *why* (used sparingly).
- No persona, no greeting, no name. The teacher's voice is the persona.
- No praise ("great job!"), no emoji, no filler. Specific, factual feedback only.
- Justification: Deci & Ryan 1999 — verbal feedback at d=+0.33 only when *specific and informational*; generic praise behaves like a tangible reward and undermines intrinsic motivation.

### D1.3 Assignment text shape (CL-3 locked)
- Free-form, length **5–250 words**.
- Always shown verbatim to student on session landing screen.
- Claude generates a 3–7 step checklist as a *derivative* — never replaces the teacher's text.
- AI prompt explicitly handles three input shapes: terse (5–15 words), medium (~50 words), narrative (150–250 words).

### D1.4 MIDI role (CL-4 locked)
- **Passive display only** in v1. Note-on events render the last 4 notes played.
- Default display is **neutral** (no color logic) — no free-text parsing of the teacher's assignment to infer tonality.
- Tonality-based green/gray coloring is only enabled when the assignment data includes an explicit structured tonality field (e.g., `tonality: "C major"`). Structured tonality fields are not in the v1 teacher UI; this is a v1.5 feature once the teacher form gains structured options.
- No tutor speech triggered by MIDI events. No advancement gating. No error correction.
- Active hint mode is v1.5; validator mode is v2 or never.

### D1.5 Teacher notification (CL-5 locked)
- **No notifications in v1.** No push, no email, no banners.
- Teacher sees status updates on next dashboard open.
- v1.5 path: optional weekly digest email. v2 path: realtime push.

### D1.6 TTS strategy
- **v1:** `expo-speech` on native (iOS), Web SpeechSynthesis on web. Free.
- Step text is **synthesized at runtime on first display** (not pre-generated, not stored as audio files — `expo-speech` is runtime synthesis only).
- Auto-play on step display. Replay button (↻) re-synthesizes on demand.
- No pre-generated audio assets in v1. Audio storage applies only when we move to a server-side TTS provider.
- **v1.5 upgrade path:** ElevenLabs (better voice quality, ~$0.02–0.05/session). At that point, audio MAY be pre-generated server-side and stored as Cloud Storage assets keyed by session+step. TTS layer isolated behind a single function so swap is one-line change.
- **v2 upgrade path:** Realtime conversational voice (OpenAI Realtime API or ElevenLabs Conversational AI). Out of scope for v1. Reason: BrainLift validation order — prove delivery thesis first.

### D1.7 Persona modes (future, parking lot)
- Future v2 feature: student/teacher selects tutor persona — *Coach* (default, neutral), *Mentor* (warm), *Drill Sergeant* (intense, no profanity).
- Profanity / "Whiplash mode" gated to v3 with explicit teacher and parent consent.
- No celebrity voice cloning (publicity-rights violation). Use stock voices or licensed VO actors.

---

## Part 2 — Tech stack lock-in

### D2.1 Application platform
- **Expo SDK 55** (latest stable as of May 2026) + React Native + TypeScript.
- **Expo Router** (file-based) for navigation. Same router for native and web.
- **NativeWind 4.1.23** (pinned — avoid 4.2.0 due to known regressions; 4.1.23 is the SDK 55 / React 19 compatible version).
- Single TypeScript codebase ships **iOS native** + **Web** (via react-native-web) in v1. Android is v2.

### D2.2 Auth + DB + Backend
- **Firebase Authentication** (email + password to start). JS SDK v12+.
- **Cloud Firestore** for all persistent state. Single database per project, region `us-central1` (or matched to function region).
- **Firebase Cloud Functions Gen 2** (Node.js 22) for any privileged operation.
- **Firebase Hosting** for the Expo web export.
- **Firebase Admin SDK** only inside Cloud Functions, never in the client.

### D2.3 Auth wiring pattern (locked)
- On native: `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`.
- On web: `getAuth(app)` (default origin-scoped local persistence).
- Single `lib/firebase.ts` module exports `auth`, `db`, `functions`, callable references.
- **Critical gotcha:** Firebase JS auth silently degrades to memory persistence if `getReactNativePersistence` is missed. TS types are wrong, no runtime warning. Verify cold-start sign-in every release.

### D2.4 Firestore data model (locked, root-collection shape)
Single root collections. No subcollections in v1 except possibly `assignments/{id}/sessions` if session history per assignment becomes a hot query (decide at implementation).

```
/users/{uid}                 — { email, role, teacherId?, createdAt }
/invites/{code}              — { teacherId, code, active, createdAt }
/invite_audits/{id}          — { teacherId, studentEmail, attestedOver13, attestedAt, termsVersion }  (immutable)
/assignments/{id}            — { teacherId, studentId, body, dueDate?, estimatedDuration?, status, createdAt, updatedAt }
/sessions/{id}               — { assignmentId, teacherId, studentId, steps, startedAt, completedAt? }
```

### D2.5 Required Firestore indexes (create at implementation)
- `assignments(studentId ASC, createdAt DESC)` — student's dashboard list
- `assignments(teacherId ASC, studentId ASC, createdAt DESC)` — teacher's per-student view
- `sessions(assignmentId ASC, startedAt DESC)` — session history per assignment

### D2.6 Firestore Security Rules (locked, full v1 ruleset)

```
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

    match /assignments/{id} {
      allow read: if signedIn() && (
        resource.data.studentId == request.auth.uid ||
        (isTeacher() && resource.data.teacherId == request.auth.uid)
      );
      allow create: if isTeacher() &&
        request.resource.data.teacherId == request.auth.uid;
      allow update, delete: if isTeacher() &&
        resource.data.teacherId == request.auth.uid;
    }

    match /sessions/{id} {
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
      allow read: if signedIn();
      allow create, update: if isTeacher() &&
        request.resource.data.teacherId == request.auth.uid;
    }

    match /invite_audits/{id} {
      allow create: if isTeacher() &&
        request.resource.data.teacherId == request.auth.uid;
      allow read: if isTeacher() &&
        resource.data.teacherId == request.auth.uid;
      allow update, delete: if false;
    }
  }
}
```

**Critical gotchas:**
- Rules are **not filters** — queries must already satisfy the rule shape or fail entirely.
- Rules **do not cascade** into subcollections — every nested `match` block must repeat its own auth checks.
- Server SDK code in Cloud Functions bypasses rules entirely. Cloud Function code is part of the privacy boundary.
- `invite_audits` is write-once (immutable) — `update` and `delete` always denied.

### D2.7 Cloud Function for AI generation (locked)
- **Type:** Gen 2 callable (`onCall` from `firebase-functions/v2/https`).
- **Region:** `us-central1`.
- **Timeout:** 30 seconds.
- **minInstances:** `1` (kills cold starts, ~$3–5/mo cost).
- **enforceAppCheck:** `true` (anti-abuse for the public callable).
- **API key:** stored via `defineSecret('ANTHROPIC_API_KEY')`, never in client.
- **Single-shot** (not streaming) for 3–7 step JSON output.
- **Retry policy:** on `429`, honor `retry-after` and single retry with jitter; on `500/529`, single bounded retry with jitter.
- **Fallback:** if generation fails after retry, return `{ steps: null, fallback: true, body: <raw teacher text> }`. Client renders the raw teacher text + single "mark complete" button per FR-G6.

### D2.8 Claude model (locked, with implementation-time verification)
- **Target primary:** `claude-haiku-4-5-20251001` (Haiku 4.5) — confirmed only by the first live API call during implementation.
  - Expected: ~$0.002/call at 500-input + 300-output tokens.
  - Expected: 3–4s end-to-end latency under typical load.
  - Capability fit: structured 3–7 step JSON from teacher text is well within Haiku 4.5's range.
- **Verified fallback:** `claude-3-5-haiku-20241022`. Use this if the 4.5 model ID is rejected or unavailable at the first implementation call.
- **Quality fallback (manual escalation):** `claude-sonnet-4-6` if Haiku step quality regresses on long teacher inputs.
- **Implementation-time gate:** the first deployment must include a runtime check — if the primary model ID is rejected, the code and docs should immediately fall back to the verified 3.5 pin and we update DECISIONS.md to reflect the actual production pin.

### D2.9 MIDI (locked)
- **Library:** `@motiz88/react-native-midi@0.0.6` — vendor and patch.
  - Last release Nov 2023 (stable but stale).
  - Covers iOS Core MIDI + Android `android.media.midi` + pass-through to Web MIDI on react-native-web in one API.
- **Required action at implementation:** vendor the package into the repo, pin the version, budget patch time if it breaks against Expo SDK 55.
- **Fallback if motiz88 fails to build:** custom Expo Module wrapping Core MIDI (Swift) + `android.media.midi` (Kotlin). ~300 LOC per platform. Documented as the v2 path if Android requires a fresh module anyway.
- **API surface used in v1:** enumerate devices, connect input, receive `note-on` / `note-off` / velocity events. No output, no SysEx.

### D2.10 TTS (locked)
- **Library:** `expo-speech` on native and web.
- **Configuration:**
  - `useApplicationAudioSession: false` (avoid contention with MIDI / other audio).
  - Wait for `speechSynthesis.getVoices()` to populate on web before first speak (Chrome returns `[]` on first synchronous call — wait for `voiceschanged`).
- **Known gotcha:** `expo-speech` is silent on physical iOS devices when the hardware silent switch is on. Document this for testers.

### D2.11 Universal Links / App Links (locked)
- **iOS:** `associatedDomains: ['applinks:app.musicbridge.<domain>']` in `app.config.ts`.
- **Android:** intent filter with `autoVerify: true`.
- **AASA file** at `/.well-known/apple-app-site-association` on Firebase Hosting.
  - Must include `Content-Type: application/json` header in `firebase.json` hosting config.
- **`firebase.json`** must explicitly set `"appAssociation": "NONE"` — otherwise Firebase Hosting overrides the AASA with its old Dynamic Links default. Universal Links break only in production. Critical.
- **Deferred deep linking pattern (v1):**
  - Web invite landing page owns the invite code.
  - If app is installed → opens via Universal Link, code passed in URL.
  - If app is not installed → web flow handles signup, invite code persists in Firestore, app reads it on first authenticated launch.

### D2.12 Distribution (locked)
- **iOS:** EAS Build production build → EAS Submit → TestFlight.
  - Internal testing only for v1 50-pilot. No Beta App Review required for internal testers.
  - Builds expire at 90 days — re-issue if pilot extends.
- **Web:** Expo web export (`npx expo export -p web`) → Firebase Hosting deploy.
- **No App Store submission in v1.** Public release is post-validation.
- **Apple Developer Program:** required for TestFlight. Owner will acquire.

### D2.13 Observability (locked)
- **Sentry** in the Expo client (native + web) via `@sentry/react-native`.
- **Cloud Functions structured logs** via `firebase-functions/logger`.
- **No Crashlytics** — would force native Firebase modules and adds no web coverage.
- **App Check** is on for callable Functions (D2.7), provides additional anti-abuse signal.

### D2.14 Privacy / COPPA (locked)
- **No personal data beyond email + role.** No name, no DOB, no address.
- **Teacher attestation flow:** at invite creation, teacher selects either *self-attested-13+* or *school-authorized*. Both modes record an immutable Firestore audit document:
  ```
  /invite_audits/{id}: {
    teacherId, studentEmail, attestedOver13, attestedAt, termsVersion
  }
  ```
- **Firebase Analytics is DISABLED across the entire app in v1** — both teacher and student surfaces. One Expo codebase makes a per-build split easy to misconfigure, and the privacy-risk asymmetry isn't worth it. Configure via `firebase.json` and platform-specific opt-out flags everywhere.
- **No third-party analytics / tracking SDKs in v1** (Mixpanel, PostHog, Amplitude all out).
- **Observability in v1 = Sentry + Cloud Functions logs only.** Sentry is error monitoring, not user analytics — different category.
- **Data deletion path:** documented but not yet automated. Manual delete via teacher request → Firestore admin script. v2 adds self-serve delete.
- **Terms version field** on every audit record (`termsVersion: "2026-05-05"`) so the legal record is reconstructable.

### D2.15 Existing accounts
| Resource | State | Action |
|---|---|---|
| Anthropic API key | Owner has one | Reuse |
| Firebase project | None | Create fresh `musicbridge` project |
| Apple Developer Program | Owner acquiring | Required before TestFlight |
| Sentry | None | Create account; free tier covers 50 testers |
| Domain (for Universal Links AASA) | Unconfirmed | Owner to register or supply (e.g., `musicbridge.app` or similar) |

---

## Part 3 — Architecture summary

```
Expo Universal App  (TypeScript + Expo Router + NativeWind 4.1.23)
├── iOS native build  ─────┐
├── Web build (RN-web)  ───┼──> Firebase Hosting
└── (Android v2)            │
                            │
       Firebase JS SDK v12+ │
                  ▼         ▼
       ┌─────────────────────────────────────┐
       │ Firebase Auth   │   Firestore + Rules │
       │ (email + pwd)   │   /users  /invites  │
       │                  │   /assignments     │
       │                  │   /sessions        │
       │                  │   /invite_audits   │
       └────────────────────┬────────────────┘
                            │
                            │ httpsCallable
                            ▼
            ┌─────────────────────────────────┐
            │ Cloud Functions Gen 2 (Node 22) │
            │ - generateSteps (App Check on)  │
            │ - any privileged op             │
            └────────────────────┬────────────┘
                                  │
                                  ▼
                  ┌─────────────────────────────┐
                  │ Anthropic Claude API        │
                  │ haiku 4.5 (haiku 3.5 fbk)   │
                  └─────────────────────────────┘

Sentry — Expo client crash + error monitoring
Cloud Logging — Functions structured logs
```

---

## Part 4 — Critical gotchas (must-bake-into-build)

These are the lessons from research that *will* break production if missed:

1. **Firebase Auth memory-persistence trap.** Use `initializeAuth` + `getReactNativePersistence(AsyncStorage)` on native. TS types pass even when wrong.
2. **AASA override by Firebase Hosting.** `"appAssociation": "NONE"` in `firebase.json`. Universal Links break only in production otherwise.
3. **Firestore rules don't cascade.** Every nested `match` repeats its own auth checks.
4. **Firebase Analytics auto-collects ad IDs.** Disable on student build for COPPA.
5. **`expo-speech` silent on iOS silent switch.** Document for testers.
6. **`@motiz88/react-native-midi` is stale.** Vendor + patch, plan to fork.
7. **Web `speechSynthesis.getVoices()` returns `[]` on first call.** Await `voiceschanged`.
8. **TestFlight builds expire at 90 days.** Re-issue if pilot extends.
9. **Firestore queries must already match rule shape.** Rules are not filters — non-matching queries fail entirely.
10. **App Check** must be configured on iOS, Android, *and* the callable Function — three-sided handshake.

---

## Part 5 — Open items (deferred, not v1 blockers)

- **OQ-1.** Many-to-many teacher-student schema for v2. v1 is one student → one teacher; v2 may need many-to-many. Schema may need `teacher_student_links` join table later. Not redesigning now.
- **OQ-2.** First test users (1–3 pilot teachers). Owner to identify before TestFlight ships.
- **OQ-3.** Marketing domain. Need a real domain for Universal Links. Owner to register.
- **OQ-4.** Data deletion automation. v1 is manual via admin script.
- **OQ-5.** Per-teacher voice / persona customization. Future feature.

---

## Part 6 — Future upgrade paths (named here so we don't paint ourselves into corners)

| Path | Trigger | Architectural prerequisite (must hold in v1) |
|---|---|---|
| ElevenLabs TTS | After v1 validates | TTS layer isolated behind `synthesizeStep(text)` function |
| Realtime conversational voice | After v1.5 | None — separate session type |
| Active MIDI hints | After v1 | MIDI events flow through a typed event bus already |
| Conversational AI tutor | After v1 | Steps schema includes optional `expectsResponse: boolean` field |
| Many-to-many teacher-student | v2 | Audit `teacherId` lookups so they survive a join-table migration |
| Persona modes (Coach / Mentor / Drill Sergeant) | v2 | TTS provider selection per-call already abstracted |
| Android native distribution | v2 | Codebase is already universal — only EAS profile + store submit changes |
| Audio detection (acoustic piano) | v2+ | Out of scope |
| Teacher analytics dashboard | v1.5 | Firestore data already shaped for query |

---

## Part 7 — What this DECISIONS document overrides

- Anywhere the PRD's **NFR-D2** says generic "row-level access" or similar — the actual mechanism is **Firestore Security Rules** with the shape in D2.6.
- Anywhere the PRD says "managed auth provider" — read **Firebase Authentication** (D2.2).
- Anywhere PRD non-goals say "no third-party analytics SDKs" — Sentry is allowed (it's error monitoring, not user analytics, and is on the teacher and student builds).
- Anywhere prior docs reference "Vercel" — removed; we are all-Firebase.
- Anywhere prior docs reference Web MIDI as primary — that's web only; iOS uses native Core MIDI per D2.9.

The PRD will be updated to reflect these in the same commit as this DECISIONS doc.
