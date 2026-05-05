// MusicBridge — Firestore document shapes.
// Mirrors the data model in DECISIONS.md D2.4.

import type { Timestamp } from 'firebase/firestore';

export type Role = 'teacher' | 'student';

export interface UserDoc {
  uid: string;
  email: string;
  role: Role;
  /** Set on students at signup via invite code. Null for teachers. */
  teacherId: string | null;
  createdAt: Timestamp;
}

export interface InviteDoc {
  /** Doc ID is the invite code itself. */
  teacherId: string;
  code: string;
  active: boolean;
  createdAt: Timestamp;
}

export type AttestationKind = 'self-attested-13+' | 'school-authorized';

export interface InviteAuditDoc {
  teacherId: string;
  studentEmail: string;
  attestedOver13: boolean;
  attestation: AttestationKind;
  attestedAt: Timestamp;
  termsVersion: string;
}

export type AssignmentStatus = 'new' | 'in_progress' | 'completed';

export interface AssignmentDoc {
  teacherId: string;
  studentId: string;
  body: string;
  dueDate: Timestamp | null;
  estimatedDuration: number | null;
  status: AssignmentStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * A generated practice step. v1 is text-only — audio is synthesized at runtime
 * via expo-speech (no pre-generated audio refs in v1, per DECISIONS D1.6).
 * Audio refs are added in v1.5 when ElevenLabs is wired.
 */
export interface SessionStep {
  index: number;
  text: string;
  done: boolean;
}

export interface SessionDoc {
  assignmentId: string;
  teacherId: string;
  studentId: string;
  steps: SessionStep[];
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  /** True if AI generation failed and we fell back to raw teacher text. */
  fallback: boolean;
  /** The Claude model that produced these steps (e.g., "claude-haiku-4-5-20251001"). Null if fallback. */
  modelUsed: string | null;
}
