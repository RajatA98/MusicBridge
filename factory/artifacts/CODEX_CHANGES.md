# Codex Changes: Decisions Doc

**Status:** Proposed  
**Last Updated:** 2026-05-05  
**Target:** `factory/artifacts/DECISIONS.md`

This artifact captures the specific changes I would make before treating `DECISIONS.md` as fully implementation-locked.

## 1. Soften the Claude model lock

**Current issue:** `DECISIONS.md` locks `claude-haiku-4-5-20251001` as primary and describes it as verified, but the research trail did not verify that model ID from Anthropic docs at the time of review.

**Change:**

- Keep Haiku 4.5 as the intended target if the owner has separately verified it.
- Rewrite the doc so the first live implementation call is the actual gate.
- Treat `claude-3-5-haiku-20241022` as the verified fallback.

**Suggested replacement shape:**

```md
### D2.8 Claude model (locked with implementation-time verification)
- **Target primary:** `claude-haiku-4-5-20251001`, if confirmed by the first live API call during implementation.
- **Verified fallback:** `claude-3-5-haiku-20241022`.
- **Quality fallback:** `claude-sonnet-4-6` if long-input step quality is not acceptable.
- If the primary model ID is rejected or unavailable at implementation time, the code and docs should immediately fall back to the verified 3.5 pin.
```

## 2. Fix the TTS wording

**Current issue:** the doc says TTS audio is “pre-generated at session start” and “persisted with the session,” which does not match how `expo-speech` works. `expo-speech` is runtime synthesis, not audio-file generation.

**Change:**

- Reword the v1 behavior to match runtime synthesis.
- Only talk about persisted audio once a server-side/provider-generated audio asset flow exists.

**Suggested replacement shape:**

```md
### D1.6 TTS strategy
- **v1:** `expo-speech` on native (iOS), Web SpeechSynthesis on web. Free.
- Step text is synthesized on first display and replayed on demand.
- Replay button available on every step.
- No pre-generated audio files are stored in v1.
```

## 3. Remove split analytics behavior in v1

**Current issue:** the doc disables Firebase Analytics on the student build but leaves open that the teacher build could enable it. In one universal app, that split is easy to misconfigure and creates unnecessary privacy risk.

**Change:**

- Disable analytics entirely in v1 for both teacher and student surfaces.
- Keep Sentry plus Functions logs as the only observability floor.

**Suggested replacement shape:**

```md
### D2.14 Privacy / COPPA (locked)
- Firebase Analytics is disabled in v1 across the entire app.
- No third-party analytics or product-tracking SDKs in v1.
- Observability in v1 is limited to Sentry error monitoring and Cloud Functions logs.
```

## 4. Loosen MIDI tonality coloring unless input is structured

**Current issue:** coloring notes based on “teacher-mentioned tonality” sounds simple in prose but is brittle if it depends on free-text parsing.

**Change:**

- For v1, either show raw last notes only, or
- only enable green/gray tonality coloring when the assignment includes an explicit structured key/scale field.

**Suggested replacement shape:**

```md
### D1.4 MIDI role (CL-4 locked)
- **Passive display only** in v1.
- Default display: last 4 notes played.
- Tonality-based coloring is only enabled when the assignment includes an explicit structured tonality field; otherwise all notes use neutral display.
- No tutor speech triggered by MIDI events. No advancement gating. No error correction.
```

## 5. Lock the full Firestore rules, not just the pattern

**Current issue:** `DECISIONS.md` fully spells out the `assignments` shape, but says `sessions` and `invites` “follow the same shape.” That leaves room for implementation drift in the highest-risk area.

**Change:**

- Replace the abbreviated rules section with the exact intended v1 rules for `users`, `assignments`, `sessions`, `invites`, and `invite_audits`.

**Suggested replacement shape:**

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

## Bottom line

I would still treat `DECISIONS.md` as the main implementation authority. These edits are about making it more defensible and less ambiguous before code starts:

- model lock should be verified, not assumed
- TTS wording should match actual runtime behavior
- analytics should stay fully off in v1
- MIDI color logic should not depend on brittle free-text inference
- Firestore rules should be copied in full, not summarized

