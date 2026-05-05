// MusicBridge — Firestore Security Rules emulator tests.
// Run with: `npm run test:rules`
// Requires the Firebase emulator.

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { setDoc, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PROJECT_ID = 'musicbridge-test';
const RULES_PATH = path.resolve(__dirname, '..', 'firestore.rules');

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf-8'),
    },
  });
});

afterAll(async () => {
  if (env) await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

async function seedTeacher(teacherId: string, email = 'teacher@example.com') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', teacherId), {
      uid: teacherId,
      email,
      role: 'teacher',
      teacherId: null,
      createdAt: new Date(),
    });
  });
}

async function seedStudent(studentId: string, teacherId: string, email = 'student@example.com') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', studentId), {
      uid: studentId,
      email,
      role: 'student',
      teacherId,
      createdAt: new Date(),
    });
  });
}

describe('users collection', () => {
  it('user can read own doc', async () => {
    await seedTeacher('t1');
    const ctx = env.authenticatedContext('t1');
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'users', 't1')));
  });

  it('user cannot read another user doc', async () => {
    await seedTeacher('t1');
    await seedStudent('s1', 't1');
    const ctx = env.authenticatedContext('s1');
    await assertFails(getDoc(doc(ctx.firestore(), 'users', 't1')));
  });
});

describe('assignments collection', () => {
  it('teacher can create an assignment for own student', async () => {
    await seedTeacher('t1');
    await seedStudent('s1', 't1');
    const ctx = env.authenticatedContext('t1');
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'assignments', 'a1'), {
        teacherId: 't1',
        studentId: 's1',
        body: 'Practice C major scale',
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  });

  it('teacher cannot create an assignment claiming another teacher', async () => {
    await seedTeacher('t1');
    await seedStudent('s1', 't1');
    const ctx = env.authenticatedContext('t1');
    await assertFails(
      setDoc(doc(ctx.firestore(), 'assignments', 'a1'), {
        teacherId: 't_other',
        studentId: 's1',
        body: 'spoof',
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  });

  it('student can read their own assignments', async () => {
    await seedTeacher('t1');
    await seedStudent('s1', 't1');
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'assignments', 'a1'), {
        teacherId: 't1',
        studentId: 's1',
        body: 'Practice',
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
    const ctx = env.authenticatedContext('s1');
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'assignments', 'a1')));
  });

  it('student cannot read other students assignments', async () => {
    await seedTeacher('t1');
    await seedStudent('s1', 't1');
    await seedStudent('s2', 't1', 'student2@example.com');
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'assignments', 'a1'), {
        teacherId: 't1',
        studentId: 's1',
        body: 'Practice',
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
    const ctx = env.authenticatedContext('s2');
    await assertFails(getDoc(doc(ctx.firestore(), 'assignments', 'a1')));
  });

  it('teacher cannot read another teachers assignments', async () => {
    await seedTeacher('t1');
    await seedTeacher('t2', 'teacher2@example.com');
    await seedStudent('s1', 't1');
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'assignments', 'a1'), {
        teacherId: 't1',
        studentId: 's1',
        body: 'Practice',
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
    const ctx = env.authenticatedContext('t2');
    await assertFails(getDoc(doc(ctx.firestore(), 'assignments', 'a1')));
  });
});

describe('invite_audits collection', () => {
  it('teacher can create an audit record', async () => {
    await seedTeacher('t1');
    const ctx = env.authenticatedContext('t1');
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'invite_audits', 'a1'), {
        teacherId: 't1',
        studentEmail: 'pupil@example.com',
        attestedOver13: true,
        attestation: 'self-attested-13+',
        attestedAt: new Date(),
        termsVersion: '2026-05-05',
      }),
    );
  });

  it('audit records are immutable — update denied', async () => {
    await seedTeacher('t1');
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'invite_audits', 'a1'), {
        teacherId: 't1',
        studentEmail: 'pupil@example.com',
        attestedOver13: true,
        attestation: 'self-attested-13+',
        attestedAt: new Date(),
        termsVersion: '2026-05-05',
      });
    });
    const ctx = env.authenticatedContext('t1');
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'invite_audits', 'a1'), { studentEmail: 'changed@example.com' }),
    );
  });

  it('audit records are immutable — delete denied', async () => {
    await seedTeacher('t1');
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'invite_audits', 'a1'), {
        teacherId: 't1',
        studentEmail: 'pupil@example.com',
        attestedOver13: true,
        attestation: 'self-attested-13+',
        attestedAt: new Date(),
        termsVersion: '2026-05-05',
      });
    });
    const ctx = env.authenticatedContext('t1');
    await assertFails(deleteDoc(doc(ctx.firestore(), 'invite_audits', 'a1')));
  });
});
