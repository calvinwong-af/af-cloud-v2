'use server';

import { getUsers, type UserRecord } from '@/lib/users';
import { verifySessionAndRole } from '@/lib/auth-server';

// ---------------------------------------------------------------------------
// Lightweight current-user profile (for display — no role gate)
// ---------------------------------------------------------------------------

export interface UserProfile {
  role: string | null;
  account_type: string | null;
  uid: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  company_id: string | null;
  company_name: string | null;
  valid_access: boolean;
  last_login: string | null;
  created_at: string | null;
}

const emptyProfile: UserProfile = {
  role: null, account_type: null, uid: null,
  first_name: null, last_name: null, email: null, phone_number: null,
  company_id: null, company_name: null,
  valid_access: false, last_login: null, created_at: null,
};

export async function getCurrentUserProfileAction(): Promise<UserProfile> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) return emptyProfile;

    const url = new URL('/api/v2/users/me', process.env.AF_SERVER_URL);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) return emptyProfile;

    const json = await res.json();
    const d = json.data;
    if (!d) return emptyProfile;

    return {
      uid: d.uid ?? null,
      role: d.role ?? null,
      account_type: d.account_type ?? null,
      first_name: d.first_name ?? null,
      last_name: d.last_name ?? null,
      email: d.email ?? null,
      phone_number: d.phone_number ?? null,
      company_id: d.company_id ?? null,
      company_name: d.company_name ?? null,
      valid_access: Boolean(d.valid_access),
      last_login: d.last_login ?? null,
      created_at: d.created_at ?? null,
    };
  } catch {
    return emptyProfile;
  }
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function fetchUsersAction(): Promise<UserRecord[]> {
  return getUsers();
}

// ---------------------------------------------------------------------------
// Shared: get idToken from session cookie
// ---------------------------------------------------------------------------

async function getIdToken(): Promise<string | null> {
  const { cookies } = await import('next/headers');
  const cookieStore = cookies();
  return cookieStore.get('af-session')?.value ?? null;
}

async function callServer(
  method: string,
  path: string,
  idToken: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = new URL(`/api/v2${path}`, process.env.AF_SERVER_URL);
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response
  }
  return { ok: res.ok, status: res.status, data };
}

function serverError(resp: { status: number; data: unknown }): string {
  if (resp.data && typeof resp.data === 'object' && 'detail' in resp.data) {
    return String((resp.data as Record<string, unknown>).detail);
  }
  return `Server responded ${resp.status}`;
}

// ---------------------------------------------------------------------------
// Create user
// ---------------------------------------------------------------------------

export interface CreateUserInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  account_type: 'AFU' | 'AFC';
  role: string;
  company_id: string | null;
}

export async function createUserAction(
  input: CreateUserInput
): Promise<ActionResult<{ uid: string }>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    // Validate inputs
    if (!input.email?.trim()) return { success: false, error: 'Email is required' };
    if (!input.password || input.password.length < 8)
      return { success: false, error: 'Password must be at least 8 characters' };
    if (!input.first_name?.trim()) return { success: false, error: 'First name is required' };
    if (!input.last_name?.trim()) return { success: false, error: 'Last name is required' };
    if (!input.role) return { success: false, error: 'Role is required' };
    if (input.account_type === 'AFC' && !input.company_id)
      return { success: false, error: 'Company is required for customer accounts' };

    const idToken = await getIdToken();
    if (!idToken) return { success: false, error: 'No session token' };

    const resp = await callServer('POST', '/users', idToken, {
      email: input.email.trim().toLowerCase(),
      password: input.password,
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      phone_number: input.phone_number?.trim() || null,
      account_type: input.account_type,
      role: input.role,
      company_id: input.company_id || null,
    });

    if (!resp.ok) return { success: false, error: serverError(resp) };

    const uid = (resp.data as Record<string, unknown> | null)?.['data'] as { uid: string } | undefined;
    return { success: true, data: { uid: uid?.uid ?? '' } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[createUserAction]', message);
    return { success: false, error: 'Failed to create user. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// Update user
// ---------------------------------------------------------------------------

export interface UpdateUserInput {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  role?: string;
  valid_access?: boolean;
  company_id?: string;
}

export async function updateUserAction(
  targetUid: string,
  input: UpdateUserInput
): Promise<ActionResult<void>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };
    if (!targetUid) return { success: false, error: 'Invalid user ID' };

    const idToken = await getIdToken();
    if (!idToken) return { success: false, error: 'No session token' };

    const resp = await callServer('PATCH', `/users/${targetUid}`, idToken, input);
    if (!resp.ok) return { success: false, error: serverError(resp) };

    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[updateUserAction]', message);
    return { success: false, error: 'Failed to update user. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// Deactivate / reactivate user
// ---------------------------------------------------------------------------

export async function deactivateUserAction(
  targetUid: string
): Promise<ActionResult<void>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };
    if (!targetUid) return { success: false, error: 'Invalid user ID' };
    if (targetUid === session.uid)
      return { success: false, error: 'You cannot deactivate your own account' };

    return updateUserAction(targetUid, { valid_access: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[deactivateUserAction]', message);
    return { success: false, error: 'Failed to deactivate user. Please try again.' };
  }
}

export async function reactivateUserAction(
  targetUid: string
): Promise<ActionResult<void>> {
  return updateUserAction(targetUid, { valid_access: true });
}

// ---------------------------------------------------------------------------
// Delete user
// ---------------------------------------------------------------------------

export async function deleteUserAction(
  targetUid: string
): Promise<ActionResult<void>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };
    if (!targetUid) return { success: false, error: 'Invalid user ID' };
    if (targetUid === session.uid)
      return { success: false, error: 'You cannot delete your own account' };

    const idToken = await getIdToken();
    if (!idToken) return { success: false, error: 'No session token' };

    const resp = await callServer('DELETE', `/users/${targetUid}`, idToken);
    if (!resp.ok) return { success: false, error: serverError(resp) };

    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[deleteUserAction]', message);
    return { success: false, error: 'Failed to delete user. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// Reset password
// ---------------------------------------------------------------------------

export async function resetPasswordAction(
  targetUid: string,
  newPassword: string
): Promise<ActionResult<void>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };
    if (!targetUid) return { success: false, error: 'Invalid user ID' };
    if (!newPassword || newPassword.length < 8)
      return { success: false, error: 'Password must be at least 8 characters' };

    const idToken = await getIdToken();
    if (!idToken) return { success: false, error: 'No session token' };

    const resp = await callServer('POST', `/users/${targetUid}/reset-password`, idToken, {
      new_password: newPassword,
    });
    if (!resp.ok) return { success: false, error: serverError(resp) };

    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[resetPasswordAction]', message);
    if (message.includes('weak-password'))
      return { success: false, error: 'Password is too weak. Use at least 8 characters.' };
    return { success: false, error: 'Failed to reset password. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// Send password reset email
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Promote customer to staff
// ---------------------------------------------------------------------------

export interface PromoteToStaffInput {
  role: 'AFU-ADMIN' | 'AFU-STAFF' | 'AFU-OPS';
}

export async function promoteToStaffAction(
  targetUid: string,
  input: PromoteToStaffInput
): Promise<ActionResult<void>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };
    if (!targetUid) return { success: false, error: 'Invalid user ID' };

    const idToken = await getIdToken();
    if (!idToken) return { success: false, error: 'No session token' };

    const resp = await callServer('PATCH', `/users/${targetUid}/promote-to-staff`, idToken, {
      role: input.role,
    });
    if (!resp.ok) return { success: false, error: serverError(resp) };

    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[promoteToStaffAction]', message);
    return { success: false, error: 'Failed to promote user. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// Send password reset email
// ---------------------------------------------------------------------------

export async function sendPasswordResetEmailAction(
  targetUid: string
): Promise<ActionResult<void>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };
    if (!targetUid) return { success: false, error: 'Invalid user ID' };

    const idToken = await getIdToken();
    if (!idToken) return { success: false, error: 'No session token' };

    const resp = await callServer('POST', `/users/${targetUid}/send-reset-email`, idToken);
    if (!resp.ok) return { success: false, error: serverError(resp) };

    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sendPasswordResetEmailAction]', message);
    return { success: false, error: 'Failed to send reset email. Please try again.' };
  }
}
