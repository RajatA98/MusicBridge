# Project Plan: MusicBridge

**Status:** Complete
**Last Updated:** 2026-05-05
**Sources:** `PROBLEM_SUMMARY.md`, `PRD.md`, `PRESEARCH.md`, `DECISIONS.md`

---

## Overview

MusicBridge ships in **6 vertical-slice phases**. Each phase is bounded, demoable on its own, and builds on prior phases. Phases 1–3 build the foundation (project, auth, pairing). Phases 4–5 build the core product (assignments + AI session). Phase 6 layers MIDI and ships to TestFlight.

Build target is 24 hours of agentic coding. Phases are sized so the heaviest one (Phase 5) gets the most budget and the lightest ones (Phase 1) compress to the minimum.

Each phase follows TDD: tests first, implementation second, integration test at phase boundary, summary in `IMPLEMENTATION_LOG.md`.

---

## Phase 1 — Foundation

**Objective:** Stand up the Expo universal app skeleton, wire Firebase, get a hello-world rendering on iOS simulator and on the web build deployed to Firebase Hosting.

**Deliverables**
- Expo SDK 55 + TypeScript + Expo Router + NativeWind 4.1.23 initialized
- `lib/firebase.ts` wiring `auth`, `db`, `functions` per D2.3 (initializeAuth on native, getAuth on web)
- Empty role-routed shell pages: `/`, `/teacher`, `/student`, `/login`
- `firebase.json` configured with `appAssociation: "NONE"` and AASA Content-Type header (D2.11)
- Sentry installed and verified (test crash captured)
- Web export deploys to Firebase Hosting cleanly
- iOS dev client builds via EAS Development Build
- Repo `.gitignore`, `eslint`, `prettier`, `tsconfig` configured
- Cloud Functions project initialized (empty placeholder function deploys)

**Acceptance criteria**
- App boots on iOS sim → renders blank "Hello MusicBridge" screen
- Web build deployed → loads without console errors
- A test Sentry event from the client appears in the Sentry dashboard
- A test invocation of the placeholder Cloud Function returns successfully
- `npm run lint && npm run typecheck` exits clean

**Risks**
- Expo SDK 55 + Firebase JS SDK + NativeWind interactions: known gotchas. **Mitigation:** pin versions per DECISIONS, validate with `expo doctor` and the build chain.
- AASA Content-Type misconfiguration is silent until production. **Mitigation:** include AASA placeholder in Phase 1 and verify served headers via curl.

---

## Phase 2 — Auth + Roles

**Objective:** Email/password signup with role selection, persistent auth, role-based routing, sign in/out flows.

**Deliverables**
- `/login` page: email + password + sign-in / sign-up toggle
- Sign-up flow: user picks "I'm a teacher" or "I'm a student" → creates Firebase Auth user → creates corresponding `/users/{uid}` Firestore doc with `{email, role, teacherId: null, createdAt}`
- Sign-in flow: existing user signs in → reads their `/users/{uid}` doc → routes to `/teacher` or `/student`
- Logout button in both shells
- Auth persistence verified: app reload preserves session; cold start preserves session on iOS
- Firestore Security Rules for `/users` collection deployed and tested
- Empty teacher dashboard and student dashboard pages with header showing logged-in email and role

**Acceptance criteria**
- New teacher signs up → lands on `/teacher`
- New student signs up → lands on `/student` (still unpaired — `teacherId: null`)
- Logout returns to `/login`
- Sign-in with existing creds skips signup and routes correctly
- App force-quit + relaunch on iOS preserves logged-in state
- Web reload preserves logged-in state
- Firestore Rules emulator tests pass for `/users` access patterns

**Risks**
- Firebase JS auth memory-persistence trap (D2.3 critical gotcha). **Mitigation:** explicit cold-start sign-in test in acceptance criteria. Run on physical-iOS sim restart, not just hot reload.
- Role mismatch (Auth user exists but Firestore doc missing) on partial-failure signup. **Mitigation:** atomic-ish signup function that creates both, with rollback on failure.

---

## Phase 3 — Pairing + Invites

**Objective:** Teacher generates an invite, student opens the link, signup auto-pairs them. Universal Links and App Links wired. Invite audit record created.

**Deliverables**
- Teacher dashboard: "Generate invite" button → creates `/invites/{code}` doc + shareable URL (e.g., `https://app.musicbridge.<domain>/invite/<code>`)
- Teacher attestation form before invite: select `self-attested-13+` or `school-authorized` (FR-A7, D2.14)
- Invite audit record `/invite_audits/{id}` created with `{teacherId, studentEmail, attestedOver13, attestedAt, termsVersion}` — immutable
- Invite landing page (`/invite/[code].tsx`) on web: reads code, validates against Firestore, prefills signup with role=student and `teacherId` from invite
- iOS Universal Links: associatedDomains set; AASA file at `/.well-known/apple-app-site-association` on Firebase Hosting
- Android App Links: intent-filter with `autoVerify: true`; assetlinks.json on Firebase Hosting
- Deferred deep linking pattern: web invite landing handles signup if app not installed, then app reads invite from URL on first launch
- Firestore Rules updated for `/invites/{code}` and `/invite_audits/{id}` per D2.6
- Teacher dashboard shows paired student emails as a list

**Acceptance criteria**
- Teacher generates invite → URL appears, copy-to-clipboard works
- Tapping URL on iOS device with app installed → opens app, lands on signup screen pre-filled with teacher pairing
- Tapping URL without app installed → opens web signup, completes flow, app first-launch picks up the pairing
- Teacher's `paired students` list updates after student signup
- Student's `/users/{uid}` doc has correct `teacherId` after signup
- `/invite_audits/{id}` record present and immutable (update/delete denied by rules)
- AASA file served with `Content-Type: application/json` (verified via `curl -I`)
- Apple's [associated-domains validator](https://branch.io/resources/aasa-validator/) passes for the AASA URL

**Risks**
- AASA misconfiguration is silent until tapped on a real device. **Mitigation:** explicit curl + validator check in acceptance.
- Universal Links don't natively support deferred deep linking — depends on web fallback. **Mitigation:** test the full "tap URL on device with no app installed → install app → open" flow on a real iPhone before declaring the phase done.
- Invite code collisions. **Mitigation:** generate codes with sufficient entropy (e.g., 8+ random base36 chars) and validate uniqueness with a transactional create.

---

## Phase 4 — Assignments (CRUD)

**Objective:** Teachers can create, edit, and delete free-text practice assignments for their paired students. Students see them in a dashboard list.

**Deliverables**
- Teacher dashboard: pick a student → "Assign practice" → multi-line text area + optional due date + optional duration → submit creates `/assignments/{id}` doc
- Teacher can view a student's assignment history with status (`new` / `in_progress` / `completed`)
- Teacher can edit or delete an assignment if status is still `new` (FR-T4)
- Student dashboard lists their assignments (sorted desc by `createdAt`) with teacher name, body preview, status, assigned date
- Firestore composite indexes deployed: `assignments(studentId ASC, createdAt DESC)`, `assignments(teacherId ASC, studentId ASC, createdAt DESC)` (D2.5)
- Firestore Rules for `/assignments/{id}` deployed and tested per D2.6
- Assignment text validation: length 5–250 words (D1.3)

**Acceptance criteria**
- Teacher creates an assignment → appears in own list and in paired student's list within seconds
- Student opens dashboard → sees the assignment with correct teacher name and body
- Teacher can edit assignment (still `new`) → changes propagate to student
- Teacher cannot edit an assignment that is `in_progress`
- Teacher CANNOT see assignments belonging to other teachers' students (Rules emulator test)
- Student CANNOT see other students' assignments (Rules emulator test)
- Index queries return without `FAILED_PRECONDITION` errors

**Risks**
- Forgetting to deploy a composite index → query fails in production. **Mitigation:** declare indexes in `firestore.indexes.json` and deploy with rules.
- Word-count validation can be tricky for non-English. **Mitigation:** count by simple whitespace split; document the limit; soft-warn rather than hard-block at edges.

---

## Phase 5 — Guided Session + AI Tutor (the heaviest phase)

**Objective:** Student starts a session on an assignment, Cloud Function calls Claude to generate a 3–7 step checklist, student walks through with TTS narration, completion updates status.

**Deliverables**
- **Cloud Function `generateSteps`** (Gen 2 callable, App Check, `defineSecret('ANTHROPIC_API_KEY')`, `minInstances: 1`, 30s timeout per D2.7)
  - Takes: `{ assignmentId }`. Reads assignment from Firestore (server-side trust check).
  - Calls Anthropic with target model `claude-haiku-4-5-20251001`, falls back to `claude-3-5-haiku-20241022` if rejected (D2.8 verification gate).
  - Returns: `{ steps: string[], fallback: false }` or `{ steps: null, fallback: true, body: string }` on failure.
  - Retry policy: 1 bounded retry on 429 (honor `retry-after`) and 500/529.
- **Session view** (`/session/[assignmentId].tsx`):
  - Header with teacher name
  - Quote-styled box with assignment text verbatim (D1.3)
  - "Start" button → creates `/sessions/{id}` doc with `status: in_progress`, sets assignment status to `in_progress`, calls `generateSteps`
  - Loading state while function runs (~3s budget per NFR-P2)
  - On success: persists `steps` to session doc; shows step 1 of N
  - On fallback: shows raw teacher text + "Mark complete" button (FR-G6)
- **Step UI**:
  - One step at a time, progress dots at top
  - Step text auto-plays via TTS on first display (D1.6) — `expo-speech` on native, Web `SpeechSynthesis` on web
  - Replay button (↻) re-synthesizes
  - "Done with this step" button advances
  - Web `SpeechSynthesis` voices loaded with `voiceschanged` await per D2.10 / Codex catch
- **Session completion**:
  - Last step → "Session complete" screen
  - Updates session doc with `completedAt`, assignment status to `completed`
  - Returns to dashboard
- **Status updates** flow back to teacher dashboard (eventual consistency via Firestore listeners or refresh on next view)

**Acceptance criteria**
- Real student on a real assignment runs the full flow end-to-end on iOS sim AND web build
- AI generation produces 3–7 plausible steps for a sample teacher input ("Practice C major scale, hands separate, 60 bpm")
- TTS plays on iOS and web; replay works on both
- Fallback path triggers when Claude API key is invalid (manual test) — student sees raw teacher text + "Mark complete"
- Session doc records `startedAt`, `steps`, `completedAt` in correct order
- Assignment status transitions `new → in_progress → completed` correctly
- Teacher sees `completed` status on next dashboard refresh
- App Check enforced — call from non-app client is rejected

**Risks**
- Claude model ID `claude-haiku-4-5-20251001` may not be available at first call. **Mitigation:** fallback to 3.5 Haiku already in code path; update DECISIONS.md with the actual production pin if 4.5 fails.
- TTS quality on web Chrome is OS-dependent (better on macOS than Linux/Windows). **Mitigation:** acceptable v1; ElevenLabs is the documented v1.5 path.
- `expo-speech` silent on iOS hardware silent switch. **Mitigation:** document for testers; nothing to fix in code.
- App Check on local emulator requires debug provider setup. **Mitigation:** wire `ReactNativeFirebase.AppCheck` debug provider in dev only.

---

## Phase 6 — MIDI + Ship

**Objective:** Wire MIDI integration on iOS native and web. Polish what's been built. Submit iOS build to TestFlight internal testers and deploy web. First real-user smoke test.

**Deliverables**
- **MIDI integration** via `@motiz88/react-native-midi@0.0.6` (vendored per D2.9)
  - "Connect MIDI" button on session view
  - iOS native: shows Core MIDI device picker; selects USB or BLE MIDI device
  - Web: requests Web MIDI access where browser supports it; shows unavailability message otherwise
  - Last 4 notes played render below step text (D1.4 — neutral display only, no tonality coloring in v1)
- **Polish pass**:
  - Empty states (no students paired, no assignments, no sessions)
  - Error states (network failure, auth failure, function failure)
  - Loading states (consistent spinner styling via NativeWind)
  - Tap targets verified ≥44pt (NFR-B5)
- **Distribution**:
  - `eas build --platform ios --profile production`
  - `eas submit --platform ios` → TestFlight internal testing
  - Web build → `firebase deploy --only hosting`
  - Apple Developer Program membership confirmed before this step
  - First 1–3 pilot teachers identified (OQ-2) and added as TestFlight internal testers
- **First real-user smoke test**:
  - Real teacher signs up on iOS app via TestFlight
  - Sends real invite to a real student
  - Real student signs up via invite link
  - Real assignment created
  - Real session run end-to-end (with or without MIDI)
  - At least one error captured by Sentry, verified actionable
- **`IMPLEMENTATION_LOG.md`** finalized with phase-by-phase summary

**Acceptance criteria**
- MIDI keyboard connects and last-4-notes display updates within 100ms of note-on
- iOS app reaches TestFlight as an internal test build
- Web build live at production URL
- One end-to-end real-user run succeeds without crash
- Sentry captures and surfaces a deliberately injected client error
- All Cloud Functions logs are structured and queryable

**Risks**
- `@motiz88/react-native-midi` doesn't build against Expo SDK 55. **Mitigation:** vendor + patch first; if irreparable, fall back to custom Expo Module wrapping Core MIDI (~300 LOC Swift). Budget 4 hours for this fallback.
- Apple Developer Program enrollment can take 24–48 hours. **Mitigation:** owner starts enrollment now, before Phase 6.
- TestFlight build expires after 90 days. **Mitigation:** acceptable for v1 pilot; document re-issue path.
- First real-user smoke test exposes flow bugs not caught by sim testing. **Mitigation:** budget time for one round of fixes after the smoke test.

---

## Build order and dependencies

```
Phase 1 (Foundation)
   │
   ▼
Phase 2 (Auth + Roles)
   │
   ▼
Phase 3 (Pairing + Invites) ──────┐
   │                                │
   ▼                                │
Phase 4 (Assignments)              (parallel-ish: deep links can be
   │                                proven on placeholder shells once
   ▼                                Phase 1 is done)
Phase 5 (Session + AI)
   │
   ▼
Phase 6 (MIDI + Ship)
```

Phases 1–5 are strictly sequential (each depends on prior data model). Phase 3's deep-link plumbing has independent components (AASA + intent filters) that can be configured early in Phase 1 to give Apple/Google time to verify domain ownership.

---

## Time budget (rough, 24-hour agentic build)

| Phase | Budget | Rationale |
|---|---|---|
| 1 | 2 hours | Skeleton + Firebase wiring is mostly config |
| 2 | 2 hours | Auth + role routing is well-trodden |
| 3 | 4 hours | Universal Links setup + AASA + invite flow has surface area |
| 4 | 3 hours | CRUD + Firestore rules + indexes |
| 5 | 7 hours | Cloud Function + Anthropic + TTS + session UI is the core |
| 6 | 5 hours | MIDI + polish + EAS build/submit + smoke test |
| Slack | 1 hour | Spillover for any phase |

Total: 24 hours. Phase 5 and Phase 6 carry the most risk; if either overruns, Phase 6 polish is the cut.

---

## What this plan deliberately does NOT include

- **App Store public submission** — TestFlight internal only. Out per DECISIONS D2.12.
- **Android build** — codebase is universal but Android profile not built or distributed in v1.
- **Teacher analytics dashboard** — v1.5+.
- **Teacher video uploads, hand animations, audio detection** — v2+.
- **Conversational AI tutor / realtime voice** — v2+.
- **ElevenLabs TTS upgrade** — v1.5 once delivery thesis is validated.
- **Self-serve data deletion** — v2.
- **Many-to-many teacher-student** — v2.

---

## Open dependencies before Phase 6 ships

These must be true before Phase 6's TestFlight submission can succeed:

- [ ] Apple Developer Program membership active
- [ ] A registered domain for Universal Links (e.g., `app.musicbridge.<tld>`)
- [ ] 1–3 pilot teachers identified and willing to receive a TestFlight invite
- [ ] Sentry account with project created
- [ ] Firebase project created (will be done in Phase 1)
- [ ] Anthropic API key in hand (owner has)
