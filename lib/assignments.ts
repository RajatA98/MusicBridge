// MusicBridge — Assignment helpers.
// Per DECISIONS.md D2.4 (data model), D2.5 (indexes), D2.6 (rules), D1.3 (text shape).

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { AssignmentDoc, AssignmentStatus } from './types';

export interface CreateAssignmentParams {
  studentId: string;
  body: string;
  dueDate?: Date | null;
  estimatedDuration?: number | null;
}

export const ASSIGNMENT_MIN_WORDS = 5;
export const ASSIGNMENT_MAX_WORDS = 250;

export function countWords(s: string): number {
  return s
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

export function validateAssignmentBody(body: string): string | null {
  const wc = countWords(body);
  if (wc < ASSIGNMENT_MIN_WORDS) {
    return `Please write at least ${ASSIGNMENT_MIN_WORDS} words.`;
  }
  if (wc > ASSIGNMENT_MAX_WORDS) {
    return `Please keep it under ${ASSIGNMENT_MAX_WORDS} words.`;
  }
  return null;
}

export async function createAssignment(params: CreateAssignmentParams): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');

  const error = validateAssignmentBody(params.body);
  if (error) throw new Error(error);

  const ref = await addDoc(collection(db, 'assignments'), {
    teacherId: user.uid,
    studentId: params.studentId,
    body: params.body.trim(),
    dueDate: params.dueDate ?? null,
    estimatedDuration: params.estimatedDuration ?? null,
    status: 'new' as AssignmentStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateAssignment(
  id: string,
  params: Partial<Pick<AssignmentDoc, 'body' | 'dueDate' | 'estimatedDuration'>>,
): Promise<void> {
  if (params.body !== undefined) {
    const error = validateAssignmentBody(params.body);
    if (error) throw new Error(error);
  }
  await updateDoc(doc(db, 'assignments', id), {
    ...params,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAssignment(id: string): Promise<void> {
  // Phase 4 only allows delete on status=new — Firestore rules handle the auth check,
  // but the client-side guard prevents the click in the first place.
  const snap = await getDoc(doc(db, 'assignments', id));
  if (!snap.exists()) return;
  const data = snap.data() as AssignmentDoc;
  if (data.status !== 'new') {
    throw new Error('This assignment has already been started; it cannot be deleted.');
  }
  await deleteDoc(doc(db, 'assignments', id));
}

export interface AssignmentRecord extends AssignmentDoc {
  id: string;
}

/** Subscribe to a student's assignments (newest first). */
export function subscribeStudentAssignments(
  studentId: string,
  cb: (records: AssignmentRecord[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'assignments'),
    where('studentId', '==', studentId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    const recs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as AssignmentDoc) }));
    cb(recs);
  });
}

/** Subscribe to a teacher's assignments for one specific student (newest first). */
export function subscribeTeacherStudentAssignments(
  teacherId: string,
  studentId: string,
  cb: (records: AssignmentRecord[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'assignments'),
    where('teacherId', '==', teacherId),
    where('studentId', '==', studentId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    const recs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as AssignmentDoc) }));
    cb(recs);
  });
}
