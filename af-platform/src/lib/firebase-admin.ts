/**
 * AcceleFreight Platform — Firebase Admin SDK Singleton
 *
 * Server-side only. Initialises the Firebase Admin SDK once.
 * Uses Application Default Credentials (ADC) — works in GCP/Firebase
 * environments and locally when GOOGLE_APPLICATION_CREDENTIALS is set.
 *
 * NEVER import in client components.
 */

import * as admin from 'firebase-admin';

let _admin: admin.app.App | null = null;

export function getFirebaseAdmin(): admin.app.App {
  if (_admin) return _admin;

  if (admin.apps.length > 0) {
    _admin = admin.apps[0]!;
    return _admin;
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      'GOOGLE_CLOUD_PROJECT_ID env var is not set. ' +
      'Add it to .env.local for local dev or ensure it is set in your deployment environment.'
    );
  }

  _admin = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });

  return _admin;
}
