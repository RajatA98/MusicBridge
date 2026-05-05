# Presearch: MusicBridge

**Status:** Complete
**Last Updated:** 2026-05-04
**Source:** `factory/artifacts/PRD.md`

---

## Discussion summary

This Presearch was driven by a series of platform-shape decisions made in conversation, in order:

1. Started from a default web-only stack (Next.js + Supabase + Vercel + Claude).
2. Owner preferred **Firebase over Supabase** for auth and database. Stack pivot to Firebase Auth + Firestore.
3. Owner reconsidered hosting: Firebase Hosting vs. Vercel.
4. Owner introduced a **mobile-first product shape**: a mobile app for the student with a web surface for the teacher and any laptop-bound user. iOS first, Android second.
5. Locked on **Expo (React Native) universal app** as the cross-platform path — one TypeScript codebase ships iOS native, Web, and (later) Android.
6. AI tutor depth: chose **thin checklist for v1, conversational tutor as v2 upgrade** — matches the PROBLEM_SUMMARY's "validate the delivery mechanism first" framing.

The final stack reflects the mobile-first pivot plus single-vendor Firebase preference.

---

## Locked technology choices

| Dimension | Choice | Rationale |
|---|---|---|
| **App platform** | Expo (React Native) universal — iOS native + Web in v1, Android in v2 | Single TypeScript codebase across platforms. Native MIDI on iOS (Core MIDI) where Web MIDI is unavailable. Web build covers desktop teachers and laptop users. Mature Firebase integration. |
| **Language** | TypeScript | Type safety across an agentic build catches a class of errors before runtime. Standard for Expo. |
| **Routing / navigation** | Expo Router (file-based) | App Router-style ergonomics on mobile; works on web build via react-native-web. |
| **Styling** | NativeWind (Tailwind for React Native) | Tailwind ergonomics, works on iOS, Android, and Web from one codebase. Avoids per-platform style trees. |
| **Auth** | Firebase Authentication (email + password to start) | Mature, free at v1 scale, native iOS SDK + JS SDK both work, role data in Firestore. |
| **Database** | Cloud Firestore | Document model fits the schema (users → assignments → sessions). Real-time listeners available if needed (not used in v1). Firestore Security Rules enforce per-user access. |
| **Server-side privileged ops** | Firebase Cloud Functions (or Cloud Run) for any operation that needs Admin SDK (e.g., generating invite codes, AI step generation) | Keeps the Anthropic API key server-side. Avoids shipping privileged credentials to the client. |
| **Hosting (web build)** | Firebase Hosting | Single-vendor with the rest of the stack. Static Expo web export deploys cleanly. |
| **Mobile distribution (v1)** | Expo development build → TestFlight for iOS testers | App Store submission is **not** in the 24-hour budget. Teacher onboarding for v1 testers is via TestFlight invite. |
| **AI provider + model** | Anthropic Claude. Model selection deferred to Decide. Default candidate: **Sonnet 4.6** for v1 (quality floor for tutor step generation), with **Haiku 4.5** as a cost-optimized fallback if generation is structured enough to tolerate a smaller model. | The tutor's only AI surface in v1 is generating a 3–7 step checklist from teacher text. Sonnet quality is the right floor; Haiku evaluated in Decide. |
| **AI tutor depth (v1)** | **(a) Thin checklist.** One Claude call at session start. 3–7 guided steps generated from teacher's free-text assignment. Steps persist with the session. No further AI calls during the session. | Validates the delivery thesis cheaply. Conversational tutor (option b) is v2. |
| **MIDI** | Native Core MIDI on iOS via React Native bridge (specific library evaluated in Decide). Web MIDI API on web. iOS Safari users see "MIDI not supported on this browser" notice — they should use the iOS app instead. | Native is the only way to get MIDI on iOS. Web MIDI handles desktop Chrome / Edge / Android Chrome. |
| **Realtime** | None for v1 | Teacher viewing student progress is fine on demand-refresh. MIDI display is local to the device. |
| **State management** | React state + Firestore listeners where useful. No global store library. | Smallest surface that works for v1 scope. |
| **Email** | Firebase Auth's built-in flows for verification and password reset | No second vendor in v1. Resend or similar deferred until we need transactional email beyond auth. |

---

## Architecture sketch

```
┌─────────────────────────────────────────────────────────┐
│                  Expo Universal App                      │
│  (TypeScript + Expo Router + NativeWind)                 │
│                                                           │
│  iOS native build  │  Web build  │  (Android v2)         │
└─────────────┬─────────────┬───────────────────┬──────────┘
              │             │                   │
              │             │                   │
              ▼             ▼                   ▼
┌─────────────────────┐    ┌─────────────────────────────┐
│ Firebase Auth       │    │ Firestore (client SDK)      │
│ (email + password)  │    │ - users                      │
└─────────────────────┘    │ - invites                    │
                            │ - assignments                │
                            │ - sessions                   │
                            │ + Security Rules             │
                            └──────────┬──────────────────┘
                                       │
                                       ▼
                            ┌─────────────────────────────┐
                            │ Cloud Functions (Node.js)   │
                            │ - generate-steps (Claude)   │
                            │ - generate-invite-code      │
                            │ - any Admin SDK op          │
                            └──────────┬──────────────────┘
                                       │
                                       ▼
                            ┌─────────────────────────────┐
                            │ Anthropic Claude API        │
                            └─────────────────────────────┘
```

- The Expo app talks to Firebase Auth and Firestore directly via the Firebase JS / native SDK.
- For privileged operations (calling Claude API, generating invite codes, anything that needs server trust), the app calls a Firebase Cloud Function which uses Admin SDK.
- Web build is a static Expo web export deployed to Firebase Hosting.

---

## Risks and constraints

### MIDI on iOS Safari is a dead end
Web MIDI API has no iOS Safari support and no near-term plan for it. **Implication:** any iOS user who wants MIDI must use the native app. We need to communicate this clearly on the web build.

### Native MIDI library quality is variable
React Native MIDI libraries are not all maintained. We will evaluate two candidates in Decide and pick based on recency, last commit, and API surface. If none is fit-for-purpose, fallback path is a small custom native module (Swift bridge for Core MIDI, ~50 lines).

### Expo + Firebase has known gotchas
Firebase JS SDK has historically had issues in Expo Go (the dev client). The accepted path is **Expo Development Build** (custom client), not Expo Go. This adds a one-time setup cost (~30 min) but unblocks Firebase native modules.

### App distribution is admin overhead
Apple Developer Program ($99/year) is required for TestFlight. Owner has indicated this will be acquired. Time cost for the agreement and provisioning is sunk outside the 24-hour build budget but is a launch dependency.

### Cost ceilings (free-tier scope)
- Firebase: free tier (Spark plan) covers thousands of monthly auth users, 1 GB Firestore, 50K reads/day, 20K writes/day. v1 testing fits comfortably.
- Cloud Functions: requires the **Blaze plan** (pay-as-you-go) once we deploy a Function that calls an external API like Anthropic. Free tier covers 2M invocations / 400K GB-seconds per month. v1 testing fits comfortably; cost is operationally near-zero.
- Anthropic API: usage-based. v1 generation is a single call per session. Conservatively estimating 5 sessions per student per week × 50 testers = 250 calls/week. Sonnet 4.6 at v1 prompt sizes is single-digit dollars per month.
- Vercel: removed from stack (was in original baseline; not used now).

### Single-vendor lock-in (Firebase)
Going all-in on Firebase is a deliberate v1 decision for simplicity. Migration off Firebase later is non-trivial — Firestore data shape doesn't translate cleanly to relational stores, and Auth migration requires user re-verification. Acceptable v1 tradeoff. Flag for re-evaluation if Firebase pricing or ergonomics fail at scale.

---

## Existing accounts

| Resource | State | Action |
|---|---|---|
| Anthropic API key | Owner has one | Reuse existing key |
| Firebase project | None — fresh `musicbridge` project to be created | Create at Decide / Implement boundary |
| Apple Developer Program | Owner will acquire | Required before TestFlight ship; not blocking earlier phases |
| Vercel | N/A — removed from stack | — |

---

## Carried open questions

These survived Presearch and are explicit Decide-phase items:

- **Q-D1.** Final Claude model: Sonnet 4.6 vs. Haiku 4.5. Test step-generation quality and cost on a representative teacher assignment before locking.
- **Q-D2.** React Native MIDI library: evaluate top candidates (e.g., `react-native-music-control`, `react-native-midi`, custom native module). Pick based on maintenance status and API fit.
- **Q-D3.** First test users: who are the 1–3 piano teachers we put this in front of?
- **Q-D4.** Onboarding the v2 conversational tutor — when do we add it, and what does the upgrade path look like? (Out of scope for v1 build, but architecture should not preclude it.)
- **Q-D5.** Multi-teacher students: PRD says one student → one teacher in v1. Open whether to allow many-to-many in v2 — affects schema design choices we make now.

---

## Inheritance and consistency

This Presearch is consistent with the PROBLEM_SUMMARY and PRD:

- The thin-slice AI tutor (v1) matches the PROBLEM_SUMMARY's explicit edit: "validate the delivery mechanism, not the full ambition of AI music pedagogy."
- The mobile-first decision is a *change* from the PRD's "web responsive only, mobile native is non-goal" framing. **PRD must be updated** in Decide / Implement to reflect the new platform shape. Specifically: FR-S* and FR-G* requirements need rewording for native + web, and NFR-B* (browser support) needs to expand to mobile platforms.
- The single-teacher-per-student v1 constraint stands.
- Gamification, parent-facing, audio detection, video upload — all still v2 or out of scope.
