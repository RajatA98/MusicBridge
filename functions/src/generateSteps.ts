// MusicBridge — generateSteps Cloud Function.
// Per DECISIONS.md D2.7, D2.8.
//
// Gen 2 callable. App Check enforced. ANTHROPIC_API_KEY via defineSecret.
// 30s timeout, minInstances:1, single bounded retry on retryable Anthropic errors.
// Graceful fallback returns raw teacher text when generation fails.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import { generateStepsForBody } from './lib/anthropic';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

interface GenerateStepsRequest {
  assignmentId: string;
}

type GenerateStepsResponse =
  | { steps: string[]; fallback: false; modelUsed: string }
  | { steps: null; fallback: true; body: string; reason: string };

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504, 529]);

export const generateSteps = onCall<GenerateStepsRequest, Promise<GenerateStepsResponse>>(
  {
    region: 'us-central1',
    timeoutSeconds: 30,
    memory: '256MiB',
    minInstances: 1,
    concurrency: 20,
    enforceAppCheck: true,
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign-in required');
    }
    const { assignmentId } = request.data ?? {};
    if (!assignmentId || typeof assignmentId !== 'string') {
      throw new HttpsError('invalid-argument', 'assignmentId is required');
    }

    const db = getFirestore();
    const assignSnap = await db.collection('assignments').doc(assignmentId).get();
    if (!assignSnap.exists) {
      throw new HttpsError('not-found', 'Assignment not found');
    }
    const assignment = assignSnap.data() as {
      teacherId: string;
      studentId: string;
      body: string;
    };

    if (assignment.studentId !== request.auth.uid) {
      // Only the assigned student can generate steps for their own session.
      throw new HttpsError('permission-denied', 'Not your assignment');
    }

    const body = assignment.body ?? '';
    if (!body.trim()) {
      return {
        steps: null,
        fallback: true,
        body,
        reason: 'empty_assignment',
      };
    }

    const apiKey = ANTHROPIC_API_KEY.value();
    if (!apiKey) {
      logger.error('[generateSteps] ANTHROPIC_API_KEY secret not set');
      return {
        steps: null,
        fallback: true,
        body,
        reason: 'no_api_key',
      };
    }

    // One bounded retry on retryable errors, with jitter.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { steps, modelUsed } = await generateStepsForBody(body, apiKey);
        return { steps, fallback: false, modelUsed };
      } catch (err: unknown) {
        const status = extractStatus(err);
        const retriable = status !== null && RETRYABLE_STATUSES.has(status);
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(
          `[generateSteps] attempt=${attempt} status=${status ?? 'n/a'} retriable=${retriable} message=${message}`,
        );
        if (attempt === 0 && retriable) {
          await sleep(300 + Math.random() * 400);
          continue;
        }
        // Non-retriable, or already retried once: fall back to raw text.
        return {
          steps: null,
          fallback: true,
          body,
          reason: status ? `status_${status}` : 'unknown',
        };
      }
    }

    // Unreachable, but TypeScript wants a return.
    return { steps: null, fallback: true, body, reason: 'unreachable' };
  },
);

function extractStatus(err: unknown): number | null {
  if (typeof err === 'object' && err !== null) {
    const e = err as { status?: number; statusCode?: number };
    if (typeof e.status === 'number') return e.status;
    if (typeof e.statusCode === 'number') return e.statusCode;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
