// MusicBridge — signup helper.
// Creates a Firebase Auth user AND the matching /users/{uid} Firestore doc atomically-ish:
// if Firestore doc creation fails, we delete the Auth user so we don't leave orphans (a key risk
// flagged in PROJECT_PLAN.md Phase 2 Risks).

import { createUserWithEmailAndPassword, deleteUser, type User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Role } from './types';

interface SignupParams {
  email: string;
  password: string;
  role: Role;
  /** For students only — set from invite code at signup time. */
  teacherId?: string | null;
}

export async function signup({
  email,
  password,
  role,
  teacherId = null,
}: SignupParams): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

  try {
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email: cred.user.email,
      role,
      teacherId: role === 'student' ? teacherId : null,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    // Roll back the orphaned Auth user.
    try {
      await deleteUser(cred.user);
    } catch {
      // Best effort. Sentry will catch downstream if this matters.
    }
    throw e;
  }

  return cred.user;
}
