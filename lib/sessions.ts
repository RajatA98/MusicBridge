// MusicBridge — Session helpers.
// A session is one run-through of an assignment. Created when the student taps Start.

import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, generateStepsCallable } from './firebase';
import type { AssignmentDoc, SessionDoc, SessionStep } from './types';
import { captureError } from './sentry';

export interface SessionWithSteps {
  id: string;
  assignmentId: string;
  steps: SessionStep[];
  fallback: boolean;
  modelUsed: string | null;
  rawBody: string;
}

/**
 * Start a session: creates a session doc, calls generateSteps Cloud Function,
 * persists steps. Sets the assignment status to in_progress.
 *
 * If generation fails, persists a fallback session whose `steps` is empty and `fallback: true`;
 * the UI shows the raw teacher text + a single "mark complete" button.
 */
export async function startSession(assignmentId: string): Promise<SessionWithSteps> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');

  // Read the assignment so we have teacherId/body for the session doc.
  const assignSnap = await getDoc(doc(db, 'assignments', assignmentId));
  if (!assignSnap.exists()) throw new Error('Assignment not found.');
  const assignment = assignSnap.data() as AssignmentDoc;

  // Mark assignment as in_progress before kicking off generation.
  await updateDoc(doc(db, 'assignments', assignmentId), {
    status: 'in_progress',
    updatedAt: serverTimestamp(),
  });

  // Call the Cloud Function. App Check should be wired before prod.
  let result:
    | { steps: string[]; fallback: false; modelUsed: string }
    | { steps: null; fallback: true; body: string; reason: string };
  try {
    const callRes = await generateStepsCallable({ assignmentId });
    result = callRes.data;
  } catch (e) {
    captureError(e);
    result = {
      steps: null,
      fallback: true,
      body: assignment.body,
      reason: 'callable_error',
    };
  }

  const steps: SessionStep[] = result.fallback
    ? []
    : result.steps.map((text, index) => ({ index, text, done: false }));

  const sessionRef = await addDoc(collection(db, 'sessions'), {
    assignmentId,
    teacherId: assignment.teacherId,
    studentId: assignment.studentId,
    steps,
    startedAt: serverTimestamp(),
    completedAt: null,
    fallback: result.fallback,
    modelUsed: result.fallback ? null : result.modelUsed,
  });

  return {
    id: sessionRef.id,
    assignmentId,
    steps,
    fallback: result.fallback,
    modelUsed: result.fallback ? null : result.modelUsed,
    rawBody: assignment.body,
  };
}

/** Mark a single step as done by index. */
export async function markStepDone(sessionId: string, index: number): Promise<void> {
  const ref = doc(db, 'sessions', sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as SessionDoc;
  const newSteps = data.steps.map((s) => (s.index === index ? { ...s, done: true } : s));
  await updateDoc(ref, { steps: newSteps });
}

/** Complete the session. Updates session.completedAt and assignment.status. */
export async function completeSession(sessionId: string, assignmentId: string): Promise<void> {
  await updateDoc(doc(db, 'sessions', sessionId), {
    completedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'assignments', assignmentId), {
    status: 'completed',
    updatedAt: serverTimestamp(),
  });
}
