// MusicBridge — invite generation + redemption.
// Per DECISIONS.md D2.4 (data model), D2.6 (rules), D2.14 (audit log).

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import Constants from 'expo-constants';
import { auth, db } from './firebase';
import type { AttestationKind, InviteDoc } from './types';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Crockford-ish base32, no ambiguous chars.
const TERMS_VERSION = '2026-05-05';

function generateCode(): string {
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export interface CreateInviteParams {
  studentEmail: string;
  attestation: AttestationKind;
}

/**
 * Create an invite + immutable audit record. Returns the shareable URL.
 *
 * Codes are random 8-char base32. Collisions are vanishingly rare; if one occurs,
 * the second `setDoc` would fail (existing doc would be overwritten silently — known limitation).
 * v1.5: switch to a transactional retry loop to harden against collisions at scale.
 */
export async function createInvite(params: CreateInviteParams): Promise<{ url: string; code: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');

  const code = generateCode();
  const auditId = `${user.uid}_${code}`;

  // Use a batched write so both the invite and the audit land or neither do.
  const batch = writeBatch(db);

  const inviteData: Omit<InviteDoc, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    teacherId: user.uid,
    code,
    active: true,
    createdAt: serverTimestamp(),
  };
  batch.set(doc(db, 'invites', code), inviteData);

  batch.set(doc(db, 'invite_audits', auditId), {
    teacherId: user.uid,
    studentEmail: params.studentEmail.trim().toLowerCase(),
    attestedOver13: true, // Both attestation kinds assert 13+. Field is for forward-compat.
    attestation: params.attestation,
    attestedAt: serverTimestamp(),
    termsVersion: TERMS_VERSION,
  });

  await batch.commit();

  const host = Constants.expoConfig?.extra?.associatedDomain as string | undefined;
  const base = host ? `https://${host}` : '';
  const url = `${base}/invite/${code}`;

  return { url, code };
}

export interface RedeemedInvite {
  code: string;
  teacherId: string;
}

/**
 * Look up an invite code at signup. Used by the invite landing page (`/invite/[code]`).
 */
export async function lookupInvite(code: string): Promise<RedeemedInvite | null> {
  const snap = await getDoc(doc(db, 'invites', code));
  if (!snap.exists()) return null;
  const data = snap.data() as InviteDoc;
  if (!data.active) return null;
  return { code, teacherId: data.teacherId };
}

/**
 * List the teacher's paired students.
 * Phase 3 uses this for the dashboard's "paired students" list.
 */
export async function listPairedStudents(teacherId: string): Promise<
  { uid: string; email: string }[]
> {
  const q = query(
    collection(db, 'users'),
    where('role', '==', 'student'),
    where('teacherId', '==', teacherId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as { email: string };
    return { uid: d.id, email: data.email };
  });
}
