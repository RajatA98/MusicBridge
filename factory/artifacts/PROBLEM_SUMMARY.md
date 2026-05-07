# Problem Summary: MusicBridge

**Status:** Complete
**Last Updated:** 2026-05-05
**Sibling artifacts:** `PRD.md`, `PRESEARCH.md`, `DECISIONS.md`

---

## What we're building

A web app that carries a piano teacher's assigned home practice — *what to practice* and *how to practice it* — into the student's home in a form the student can act on alone, with an AI tutor that guides the practice session and optional MIDI integration that lets the system see what the student plays in real time.

## Why we're building it

The thesis is established by a separate BrainLift (*What the Lesson Doesn't Carry Home*, archived in `brainlifts/piano-practice-gap/`). In short:

- Piano students who already take lessons often fail to practice productively at home not primarily because they lack motivation, but because they do not reliably know **what** to practice or **how** to practice it once the teacher is not in the room.
- Existing piano apps (Simply Piano, Yousician, Piano Marvel) often bridge this gap with gamified engagement loops. The BrainLift argues this is the wrong primary design lever: the stronger opportunity is not more points, streaks, or badges, but better transfer of teacher intent into home practice.
- The actual missing layer is *delivery*: getting the teacher's specific instructions to the bench at the moment of practice, in a form the student can act on alone.

The product is the delivery layer the BrainLift argues should exist.

## What problem it solves

- A piano teacher writes a lesson note ("Practice C major scale, hands separate at 60 bpm") and the student goes home and either forgets it, postpones it, or misinterprets it.
- The teacher has no visibility into what the student actually does during home practice.
- The student sits at the bench, doesn't know where to start, and either runs the piece nose-to-tail (the most common ineffective strategy per Hallam 2001 and Duke 2009) or skips practice entirely.
- The next lesson begins with the same gap reopening.

MusicBridge replaces the sticky note with a structured, AI-guided session that follows the teacher's intent.

## Target user

**Primary user:** the student. They open the app at home and run their assigned practice with the AI tutor.

**Secondary user:** the teacher. They use the portal to assign practice plans to their existing students.

**Acquisition model:** teacher-led. The teacher tells their existing students to download the app. Students do not discover the app independently — they come because their teacher signed them up. This is a digital extension of an already-scheduled lesson relationship, not a self-directed learning marketplace.

**Out of scope as users:**
- Self-taught learners with no teacher (the lesson-to-home translation framing requires a teacher in the loop)
- Parents (intentionally — research warns against parent-as-relay; the teacher is the relay)

## Core flows (MVP)

1. **Teacher onboarding:** teacher signs up, enters role as "teacher," gets a shareable invite link/code.
2. **Student onboarding:** student receives invite link from teacher, signs up with role "student," is automatically paired with that teacher.
3. **Teacher assigns practice:** teacher writes a free-text practice assignment ("Practice C major scale, hands separate, 60 bpm, focus on smooth thumb-under in measure 2") and assigns it to a specific student.
4. **Student opens dashboard:** sees a list of assigned practices.
5. **Student starts a session:** clicks "Practice with AI tutor" on an assignment.
6. **Optional MIDI connection:** student can connect a digital keyboard via Web MIDI API. The session adapts to whether MIDI is connected or not.
7. **Guided practice session:** an AI tutor reads the teacher's text assignment and walks the student through it — describes the task, prompts effective practice behaviors (segmentation, slow practice, error targeting), and reacts to MIDI input if connected.

## Constraints

- **Build target:** 24 hours of agentic coding.
- **Production target:** real users (teachers and their actual students), not just a demo.
- **Tech direction:** managed services where possible (auth, database, hosting). No custom auth. No self-hosted database. **iOS native (iPhone + iPad) is the v1 primary target; Web ships alongside for the teacher's laptop workflow; Android in v2** (see `DECISIONS.md` D2.1, D2.12 for rationale and distribution detail).
- **Cost:** free for users in v1. Monetization deferred.
- **Privacy concerns flagged:** child data (COPPA implications if students are under 13). This is not a launch detail; it is a product constraint. For early testing, access must be restricted to adult students or students confirmed 13+ with teacher-mediated onboarding.

## Non-Goals (explicitly deferred to v2 or later)

- Teacher-uploaded demonstration videos
- Hand-movement animations
- Audio-only detection (so the system works with acoustic pianos, not just digital)
- Android native (deferred to v2 — Expo codebase will be ready, just not built or distributed in v1)
- Teacher analytics dashboard / practice quality reporting
- Payments and subscriptions
- A pre-built lesson library / lesson authoring UI (option C from discovery — deferred)
- Structured assignment forms (option B — deferred; v1 is plain text)
- Real-time tone, posture, technique evaluation (out of scope per BrainLift's own constraints)
- Parent-facing surfaces of any kind

## Open questions (to resolve in later phases)

- **AI tutor pedagogy depth:** explicitly punted on — how much Duke-behavior coaching does the tutor do, what happens on student errors, what's the conversational style? (Decide phase.)
- **Thin-slice MVP:** what is the minimum product that proves the delivery thesis? A full conversational tutor may be more than v1 needs if a simpler guided flow can validate the core behavior change. (Decide phase.)
- **Auth provider:** Clerk vs. Supabase Auth vs. NextAuth vs. other. (Decide phase.)
- **Database / hosting:** Supabase vs. plain Postgres + Vercel vs. other managed combos. (Decide phase.)
- **Frontend stack:** Next.js / React / SvelteKit / something else. (Decide phase.)
- **AI model:** which model/provider is good enough for tutor quality at acceptable cost? (Decide phase.)
- **MIDI on mobile:** Web MIDI API works on Chrome/Edge desktop and Android Chrome. iOS Safari does NOT support Web MIDI. Implication for student access TBD. (Presearch / Decide phase.)
- **First test users:** who are the first 1–3 teachers we put this in front of, and how do we recruit them? (Out of scope for Understand phase but important context.)

## Inheritance from prior work

The BrainLift `brainlifts/piano-practice-gap/BRAINLIFT.md` is a primary input to this project. Its three SPOVs, four insights, and twelve sources establish the design constraints of any product that takes this thesis seriously. In particular:

- The product must not rely on gamification of the experience (SPOV 1, SPOV 2 — supported by Hanus & Fox 2015, Deci & Ryan 1999).
- The product must be teacher-extending, not teacher-replacing (SPOV 3 — supported by Creech & Hallam 2003, McPherson 2005).
- Success metric is *did the student practice productively this week*, not *did the student log in this week* (SPOV 2 critique of in-app engagement metrics).
- The product is bounded by the 21% deliberate-practice ceiling (Insight 4 — Macnamara 2014). It is honest design to acknowledge it does not solve the talent / starting-age / instructor-quality 79%.
- The first thing to validate is the *delivery mechanism*, not the full ambition of AI music pedagogy. If the product cannot reliably carry teacher intent into home practice, nothing else matters.
