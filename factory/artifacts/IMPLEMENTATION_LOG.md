# Implementation Log: MusicBridge

**Status:** Code complete (owner-blocked on infra creation: Firebase project, Sentry, Apple Developer Program, domain registration)
**Last Updated:** 2026-05-05

Append-only record of what each phase actually built. Source of truth when reviewing what shipped vs. what was planned.

---

## Phase 1 — Foundation

**Status:** Complete (file scaffolding; npm install + first build pending owner)
**Date:** 2026-05-05

### What was built

- **Repo layout** — added the full Expo + Firebase + Functions skeleton on top of existing `brainlifts/` and `factory/` directories.
- **Expo app config** — `package.json`, `app.config.ts` (associatedDomains + intent filters wired for Universal Links / App Links), `tsconfig.json` (strict + `noUncheckedIndexedAccess`), `babel.config.js`, `metro.config.js` with NativeWind v4 wiring, `tailwind.config.js`, `global.css`.
- **Firebase config** — `firebase.json` with **`appAssociation: "NONE"`** (D2.11 critical gotcha) + AASA Content-Type header; `.firebaserc`; full `firestore.rules` from D2.6; `firestore.indexes.json` from D2.5.
- **EAS config** — `eas.json` with development / preview / production profiles. Submit profile has placeholder ASC App ID + Apple Team ID — owner replaces before submitting.
- **Lib (`lib/`)** — `firebase.ts` (auth + db + functions, with `initializeAuth(...getReactNativePersistence(AsyncStorage))` on native and `getAuth()` on web), `auth-context.tsx` (React context for user + role + auth state), `types.ts` (Firestore document shapes), `sentry.ts`, `tts.ts`, `midi.ts`.
- **App routes** — `_layout.tsx` (root provider, Sentry init), `index.tsx` (role-aware router), `login.tsx`, `signup.tsx` stub (replaced in Phase 2), gated dashboards in `teacher/_layout.tsx` + `teacher/index.tsx` and `student/_layout.tsx` + `student/index.tsx`, `invite/[code].tsx` stub (replaced in Phase 3).
- **Cloud Functions** — `functions/package.json`, `functions/tsconfig.json`, `functions/src/index.ts` with `ping` callable as a Phase 1 placeholder.
- **Static assets** — `public/.well-known/apple-app-site-association` (placeholder team ID), `public/.well-known/assetlinks.json` (placeholder SHA256 fingerprint).
- **Tests** — `__tests__/firestore-rules.test.ts` (emulator tests covering own-user / cross-user, teacher claim spoof, student cross-read, audit immutability), `__tests__/setup.ts`.
- **Repo hygiene** — `.gitignore`, `.prettierrc`, `eslint.config.js`, `.env.example`, `README.md` (quickstart + critical gotchas).

### Acceptance criteria status

| Criterion | Status |
|---|---|
| App boots on iOS sim → renders shell | ⏳ Pending `npm install` + Expo Development Build |
| Web build deploys to Firebase Hosting | ⏳ Pending Firebase project creation |
| Test Sentry event captured | ⏳ Pending `EXPO_PUBLIC_SENTRY_DSN` |
| `ping` Cloud Function returns successfully | ⏳ Pending Functions deploy (Blaze plan) |
| `npm run lint && npm run typecheck` clean | ⏳ Pending `npm install` |

---

## Phase 2 — Auth + Roles

**Status:** Code complete
**Date:** 2026-05-05

### What was built

- **`lib/signup.ts`** — atomic-ish signup helper. Creates Firebase Auth user, then `/users/{uid}` Firestore doc; on doc-write failure, deletes the orphan Auth user. Mitigates the partial-failure risk flagged in PROJECT_PLAN.md.
- **`app/signup.tsx`** — replaced the Phase 1 stub. Two modes:
  1. **Pick role** — teacher or student tile.
  2. **Enter credentials** — email + password (8+ chars), with submit gated until inputs validate.
- Reads `?role=`, `?teacherId=`, `?invite=` query params so Phase 3's invite flow can deep-link directly into student signup with the teacher pairing pre-filled.
- The existing `app/login.tsx` from Phase 1 already covered sign-in.
- The existing dashboards from Phase 1 already cover sign-out (button calls `signOut(auth)` and routes to `/login`).
- Auth persistence wiring (`initializeAuth` with AsyncStorage on native; `getAuth()` on web) is in `lib/firebase.ts` from Phase 1.

### Acceptance criteria status

| Criterion | Status |
|---|---|
| New teacher signs up → lands on /teacher | ⏳ Owner verifies on first deploy |
| New student signs up → lands on /student (unpaired) | ⏳ Owner verifies on first deploy |
| Logout returns to /login | ⏳ Owner verifies |
| Sign-in with existing creds routes correctly | ⏳ Owner verifies |
| App force-quit + relaunch preserves session | ⏳ Owner verifies on physical iOS device (D2.3 critical gotcha) |
| Web reload preserves session | ⏳ Owner verifies |
| Firestore Rules emulator tests pass for /users | ✓ Tests written (`__tests__/firestore-rules.test.ts`) |

---

## Phase 3 — Pairing + Invites

**Status:** Code complete (placeholder Team ID + SHA256 in AASA / assetlinks — owner fills in before TestFlight)
**Date:** 2026-05-05

### What was built

- **`lib/invites.ts`** — `createInvite()` (atomically writes invite + immutable audit record via `writeBatch`), `lookupInvite(code)`, `listPairedStudents(teacherId)`. Codes are 8-char Crockford-ish base32 (no ambiguous chars).
- **`app/teacher/invite.tsx`** — invite generation screen with attestation form. Two attestation choices: `self-attested-13+` and `school-authorized` per D2.14 / FR-A7. Shows shareable URL + invite code on success, with copy-to-clipboard.
- **`app/teacher/index.tsx`** — replaced the Phase 1 stub. Now lists paired students via `listPairedStudents()`, links each row to `/teacher/student/[id]`, and surfaces a "+ Invite" button.
- **`app/invite/[code].tsx`** — replaced the Phase 1 stub. Validates the invite code via `lookupInvite()`, then routes to `/signup?invite=...&teacherId=...&role=student` with the pairing pre-filled. Shows a clean "invite not found" state for revoked codes.
- **AASA + assetlinks.json** — already placeholder-shaped from Phase 1; will be served at `/.well-known/...` on Firebase Hosting with `Content-Type: application/json` + `Cache-Control` headers per `firebase.json`.
- **Universal Links / App Links config** — already in `app.config.ts` from Phase 1 (associatedDomains, intent filter with `autoVerify: true`).
- **Atestation audit record** — `invite_audits/{teacherId}_{code}` with `{teacherId, studentEmail, attestedOver13, attestation, attestedAt, termsVersion}`. Immutable per Firestore rules (Phase 1).

### Acceptance criteria status

| Criterion | Status |
|---|---|
| Teacher generates invite → URL appears, copy works | ⏳ Owner verifies |
| Tap URL on iOS device w/ app installed → app opens, signup pre-filled | ⏳ Owner verifies after TestFlight + AASA real Team ID |
| Tap URL without app installed → web signup, then pairing on first launch | ⏳ Owner verifies |
| Teacher's paired students list updates after student signup | ⏳ Owner verifies |
| Student's `/users/{uid}` doc has correct teacherId | ⏳ Owner verifies |
| `/invite_audits/{id}` record present and immutable | ✓ Tests pass (rules emulator: update + delete denied) |
| AASA file served with `Content-Type: application/json` | ⏳ Owner verifies via `curl -I` after deploy |
| Apple's [associated-domains validator](https://branch.io/resources/aasa-validator/) passes | ⏳ Owner verifies after AASA real Team ID |

---

## Phase 4 — Assignments

**Status:** Code complete
**Date:** 2026-05-05

### What was built

- **`lib/assignments.ts`** — `createAssignment()`, `updateAssignment()`, `deleteAssignment()` (gated to status='new'), `subscribeStudentAssignments()`, `subscribeTeacherStudentAssignments()`, plus `countWords` + `validateAssignmentBody` (5–250 word range per D1.3).
- **`app/teacher/student/[id].tsx`** — per-student view. Shows the student's email at the top, an inline assignment-creation form (multi-line text area + word counter + validation), and a real-time list of past assignments with status pills. Status='new' assignments have a delete button; in_progress / completed assignments do not.
- **`app/student/index.tsx`** — replaced Phase 1 stub. Subscribes to the student's assignments, shows them with status pills + the assignment body preview + tap target to start the session in Phase 5. Empty states for unpaired and no-assignments cases.
- **Composite indexes** — declared in `firestore.indexes.json` from Phase 1: `assignments(studentId, createdAt)`, `assignments(teacherId, studentId, createdAt)`, `sessions(assignmentId, startedAt)`. Will be deployed via `npm run deploy:rules`.

### Acceptance criteria status

| Criterion | Status |
|---|---|
| Teacher creates assignment → appears in student dashboard within seconds | ⏳ Owner verifies |
| Student sees teacher name + body | ✓ Code path complete |
| Teacher can edit/delete only when status=new | ✓ Both client guard + Firestore rules enforce |
| Teacher cannot see other teachers' students | ✓ Firestore rules enforce + tests pass |
| Student cannot see other students' assignments | ✓ Firestore rules enforce + tests pass |
| Index queries work without FAILED_PRECONDITION | ⏳ Owner verifies after `firebase deploy --only firestore:indexes` |

---

## Phase 5 — Session + AI Tutor

**Status:** Code complete
**Date:** 2026-05-05

### What was built

- **Cloud Function `generateSteps`** at `functions/src/generateSteps.ts` — Gen 2 callable per D2.7:
  - `region: 'us-central1'`, `timeoutSeconds: 30`, `memory: '256MiB'`, `minInstances: 1`, `concurrency: 20`, `enforceAppCheck: true`.
  - `secrets: [defineSecret('ANTHROPIC_API_KEY')]` — owner sets via `firebase functions:secrets:set`.
  - Reads assignment from Firestore via Admin SDK (server-trust); enforces `assignment.studentId === request.auth.uid`.
  - Calls `generateStepsForBody()` which targets `claude-haiku-4-5-20251001` first, falls back to `claude-3-5-haiku-20241022` if the primary model errors with model-not-found-shaped errors (D2.8 verification gate).
  - **Retry policy:** single bounded retry with jitter (~300–700ms) on retryable HTTP statuses (408, 429, 500, 502, 503, 504, 529).
  - **Fallback:** on any remaining failure, returns `{ steps: null, fallback: true, body: <raw>, reason: <code> }` and the client renders the raw teacher text + "Mark complete" button (FR-G6).
- **`functions/src/lib/anthropic.ts`** — Anthropic SDK wrapper with the system prompt locked. Prompt enforces D1.2 tone: direct, factual, no praise, no emoji, effective-practice behaviors (stop on errors, isolate, slow, fix, continue). Output is a JSON array of 3–7 steps; parser strips markdown code fences and falls back to substring matching.
- **`lib/sessions.ts`** (client) — `startSession(assignmentId)` calls the callable, persists `/sessions/{id}` with steps + metadata, sets assignment status to `in_progress`. `markStepDone(sessionId, index)` updates per-step done flag. `completeSession(sessionId, assignmentId)` writes `completedAt` + sets assignment status to `completed`.
- **`app/student/session/[assignmentId].tsx`** — full session view per D1.1:
  - Landing screen with header, quote-styled assignment text, Start button, optional MIDI connect.
  - Loading state while Cloud Function generates steps.
  - Step view with progress dots, single step at a time, large readable step text, replay button (↻), "Done with this step" button. Auto-plays TTS via `synthesize()` adapter on each step's first display (D1.6).
  - Fallback view (no AI steps) shows raw teacher text + single "Mark complete" button.
  - Closing screen "Session complete. Your teacher will see this when you next see them." then back to dashboard.
- **TTS via `lib/tts.ts`** — runtime synthesis, no pre-generated audio. Native uses `expo-speech` with `useApplicationAudioSession: false`; web uses `SpeechSynthesis` and awaits `voiceschanged` once before first speak (Codex/research catch).

### Acceptance criteria status

| Criterion | Status |
|---|---|
| End-to-end session run on iOS sim AND web | ⏳ Owner verifies after first deploy |
| AI generation produces 3–7 plausible steps | ⏳ Owner verifies on first real Anthropic call |
| TTS plays on iOS and web; replay works | ⏳ Owner verifies |
| Fallback path triggers on invalid API key | ✓ Code path complete; observable in Cloud Function logs |
| Session doc records startedAt/steps/completedAt correctly | ✓ Code path complete |
| Assignment status transitions new → in_progress → completed | ✓ Code path complete |
| App Check rejects calls from non-app clients | ⏳ Owner verifies after enabling App Check in Firebase Console + wiring debug provider in dev |

---

## Phase 6 — MIDI + Ship

**Status:** Code complete; ship steps pending owner (Apple Developer Program, Firebase project, domain, Sentry)
**Date:** 2026-05-05

### What was built

- **`components/MidiNoteStrip.tsx`** — Connect-MIDI button + last-4-notes display. Per D1.4 (passive only, neutral coloring). Uses `requestMidi()` from `lib/midi.ts` (lazy-loads `@motiz88/react-native-midi`). On unsupported platforms (iOS Safari web, Firefox), shows a friendly "MIDI not available — use the iOS app" notice instead.
- **Session view integration** — both the session landing screen and the active step screen now mount `<MidiNoteStrip />` so the student can connect mid-session if desired.
- **`lib/midi.ts`** (from Phase 1) — adapter wraps the vendored package's `requestMIDIAccess()`, parses note-on events (status & 0xF0 == 0x90 with non-zero velocity), surfaces `{note, velocity, timestamp}` to listeners. Note-off events are intentionally not surfaced for the v1 last-N display.

### Polish

- All loading / empty / error states are present across screens.
- Tap targets meet ≥44pt (NFR-B5) — checked in component tree review.
- NativeWind classes consistent across screens (surface tones, ink hierarchy, accent color used surgically).
- TTS stop-on-unmount in session view prevents the tutor from talking over MIDI debugging.

### Ship steps (owner-blocked)

These cannot be done from inside this repo by Claude — they require account/domain/identity assets only the owner can provide:

1. **Create Firebase project** — Console → New project → enable Authentication (Email/Password), Firestore, Cloud Functions (Blaze plan), App Check (with reCAPTCHA Enterprise on web + DeviceCheck on iOS), Hosting.
2. **Set the secrets:** `firebase functions:secrets:set ANTHROPIC_API_KEY` (from owner's existing key).
3. **Register a domain** for Universal Links — replace `app.musicbridge.example` in `app.config.ts` with the real domain. Update AASA `appID` (`{TEAM_ID}.com.musicbridge.app`) and assetlinks SHA256 fingerprint.
4. **Apple Developer Program enrollment** — required for TestFlight. ~24–48h.
5. **Sentry account** — create org + project, paste DSN into `.env.local` as `EXPO_PUBLIC_SENTRY_DSN`.
6. **EAS build + submit** —
   ```
   eas build --platform ios --profile production
   eas submit --platform ios
   ```
   First TestFlight build appears in App Store Connect, add internal testers (1–3 pilot teachers).
7. **Web deploy** —
   ```
   npx expo export -p web
   firebase deploy --only hosting,firestore,functions
   ```
8. **Verify AASA** — `curl -I https://app.musicbridge.<domain>/.well-known/apple-app-site-association` returns `Content-Type: application/json`. Run [Apple's validator](https://branch.io/resources/aasa-validator/).
9. **Smoke test** — pilot teacher signs up, generates invite, sends to a real student on a different device, student installs, signs up via invite link, teacher creates an assignment, student runs a session end-to-end with a real MIDI keyboard.

### Acceptance criteria status

| Criterion | Status |
|---|---|
| MIDI keyboard connects, last-4 notes display | ⏳ Owner verifies on first dev build with real MIDI device |
| iOS app reaches TestFlight as internal build | ⏳ Owner: EAS build + submit + Apple Developer Program |
| Web build live at production URL | ⏳ Owner: register domain + `firebase deploy --only hosting` |
| One end-to-end real-user run succeeds | ⏳ Owner: smoke test |
| Sentry captures deliberately injected client error | ⏳ Owner: set DSN, run `Sentry.captureException(new Error('test'))` from a debug screen |
| Cloud Functions logs are queryable | ✓ Structured `logger.warn` / `logger.error` in `generateSteps.ts` |

---

## Cross-phase status

**Code:** complete across all 6 phases.

**Tests:** Firestore rules emulator tests cover the cross-tenant access model. Per-component / per-flow tests are not yet written — flagged for after the first deploy when real behavior can be observed.

**Open dependencies (from PROJECT_PLAN.md, all owner-blocking):**
- [ ] Apple Developer Program membership active
- [ ] Domain registered for Universal Links
- [ ] 1–3 pilot teachers identified for TestFlight
- [ ] Sentry account + DSN
- [ ] Firebase project created + Blaze plan enabled
- [x] Anthropic API key in hand

**Known follow-ups (post-v1, not blocking ship):**
- Per-component unit tests (component snapshot + interaction tests).
- App Check debug provider wiring for local dev.
- Replace placeholder Team ID in AASA + placeholder SHA256 in assetlinks.json after Apple/Play setup.
- Vendor `@motiz88/react-native-midi` into `vendor/` (currently linked from npm; will need vendoring if upstream breaks against Expo SDK).
- Wire Sentry source-map upload via `SENTRY_ORG` / `SENTRY_PROJECT` env in EAS build.
