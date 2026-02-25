/**
 * AcceleFreight Platform — Server-Side Auth Helper
 *
 * Provides:
 * - verifySessionAndRole: validates Firebase ID token + role check
 * - logAction: writes to AFSystemLogs Kind in Datastore
 *
 * Used by all Server Actions as the security/logging layer.
 *
 * NEVER import this in client components — server-side only.
 */

// NOTE: In the existing Datastore, role naming is counterintuitive:
// AFU-ADMIN = AcceleFreight internal admin (staff)
// AFC-ADMIN = AcceleFreight company admin
// AFC-M     = AcceleFreight company manager
// Do not rename until coordinated Datastore migration with webserver rebuild.

import { getDatastore } from './datastore-query';
import type { AccountType } from './types';

// ---------------------------------------------------------------------------
// Session verification
// ---------------------------------------------------------------------------

export interface SessionInfo {
  valid: boolean;
  uid: string;
  email: string;
  account_type: AccountType;
  role: string | null;
  company_id: string | null;
}

const INVALID_SESSION: SessionInfo = {
  valid: false,
  uid: '',
  email: '',
  account_type: 'AFU',
  role: null,
  company_id: null,
};

/**
 * Verifies the Firebase ID token from the request headers.
 * Checks that the user's role is in the allowed list.
 *
 * In Next.js 14 App Router, the ID token must be sent as a cookie
 * (set by the client-side auth flow) or via Authorization header.
 *
 * NOTE: This implementation assumes cookies('af-session') holds the
 * Firebase ID token. The client login flow sets this cookie on sign-in.
 * Update if the session strategy changes.
 */
export async function verifySessionAndRole(
  allowedRoles: string[]
): Promise<SessionInfo> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) return INVALID_SESSION;

    // Verify with Firebase Admin SDK
    const { getFirebaseAdmin } = await import('./firebase-admin');
    const admin = getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    const uid = decodedToken.uid;
    const email = decodedToken.email ?? '';

    // Fetch UserIAM for role + access check
    const datastore = getDatastore();
    const iamKey = datastore.key(['UserIAM', uid]);
    const [iamEntity] = await datastore.get(iamKey);

    if (!iamEntity) return INVALID_SESSION;

    const validAccess = iamEntity.valid_access ?? false;
    if (!validAccess) return INVALID_SESSION;

    const role = iamEntity.role as string ?? null;
    const accountType = iamEntity.account_type as AccountType ?? 'AFU';

    // Check role authorisation
    if (!allowedRoles.includes(role)) return INVALID_SESSION;

    const cuaKey = datastore.key(['CompanyUserAccount', uid]);
    const [cuaEntity] = await datastore.get(cuaKey);
    const companyId = (cuaEntity?.company_id as string | null) ?? null;

    return {
      valid: true,
      uid,
      email,
      account_type: accountType,
      role,
      company_id: companyId,
    };
  } catch (err) {
    console.error('[verifySessionAndRole] Auth error:', err);
    return INVALID_SESSION;
  }
}

// ---------------------------------------------------------------------------
// Process Logging — Core Pillar 1
// ---------------------------------------------------------------------------

export interface LogActionParams {
  uid: string;
  email: string;
  account_type: AccountType;
  action: string;
  entity_kind: string;
  entity_id: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  success: boolean;
  error?: string | null;
  meta?: Record<string, unknown>;
}

/**
 * Writes a log entry to the AFSystemLogs Kind in Datastore.
 * Non-blocking — errors are caught and logged to console, never thrown.
 *
 * Called on every significant operation (view, create, update, delete).
 */
export async function logAction(params: LogActionParams): Promise<void> {
  try {
    const datastore = getDatastore();
    const key = datastore.key('AFSystemLogs');  // Auto-ID

    const logEntry = {
      timestamp: new Date().toISOString(),
      uid: params.uid,
      email: params.email,
      account_type: params.account_type,
      action: params.action,
      entity_kind: params.entity_kind,
      entity_id: params.entity_id,
      before: params.before ?? null,
      after: params.after ?? null,
      success: params.success,
      error: params.error ?? null,
      meta: params.meta ?? {},
    };

    await datastore.save({ key, data: logEntry });
  } catch (logErr) {
    // Logging must never crash the application
    console.error('[logAction] Failed to write system log:', logErr);
  }
}
