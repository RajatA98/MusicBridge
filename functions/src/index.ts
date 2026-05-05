// MusicBridge — Cloud Functions entry point.
// Phase 5 adds generateSteps. Phase 1 ships an empty hello function so deploy works.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';

initializeApp();

/**
 * Phase 1 placeholder — kept after Phase 5 lands so deploy/health checks have a known callable.
 * Returns the caller's uid if signed in.
 */
export const ping = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 10,
  },
  (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign-in required');
    }
    return { ok: true, uid: request.auth.uid, ts: Date.now() };
  },
);

export { generateSteps } from './generateSteps';
