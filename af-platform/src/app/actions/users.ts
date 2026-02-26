'use server';

import { getUsers, type UserRecord } from '@/lib/users';
import { verifySessionAndRole, logAction } from '@/lib/auth-server';
import { getDatastore } from '@/lib/datastore-query';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function fetchUsersAction(): Promise<UserRecord[]> {
  return getUsers();
}

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
    // Auth — only AFU-ADMIN (internal staff admin) can create users
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    // Validate inputs
    if (!input.email?.trim()) return { success: false, error: 'Email is required' };
    if (!input.password || input.password.length < 8)
      return { success: false, error: 'Password must be at least 8 characters' };
    if (!input.first_name?.trim()) return { success: false, error: 'First name is required' };
    if (!input.last_name?.trim()) return { success: false, error: 'Last name is required' };
    if (!input.role) return { success: false, error: 'Role is required' };
    if (input.account_type === 'AFC' && !input.company_id)
      return { success: false, error: 'Company is required for customer accounts' };

    const admin = getFirebaseAdmin();
    const datastore = getDatastore();
    const now = new Date().toISOString();

    // 1. Create Firebase Auth user
    const firebaseUser = await admin.auth().createUser({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      displayName: `${input.first_name.trim()} ${input.last_name.trim()}`,
    });
    const uid = firebaseUser.uid;

    // 2. Create UserAccount entity
    const userAccountKey = datastore.key(['UserAccount', uid]);
    await datastore.save({
      key: userAccountKey,
      data: {
        uid,
        email: input.email.trim().toLowerCase(),
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        phone_number: input.phone_number?.trim() || null,
        account_type: input.account_type,
        email_validated: false,
        status: true,
        user: session.email,
        created: now,
        updated: now,
      },
    });

    // 3. Create UserIAM entity
    const iamKey = datastore.key(['UserIAM', uid]);
    await datastore.save({
      key: iamKey,
      data: {
        uid,
        role: input.role,
        account_type: input.account_type,
        valid_access: true,
        active: true,
        user: session.email,
        updated: now,
      },
    });

    // 4. Create CompanyUserAccount if AFC (customer)
    if (input.account_type === 'AFC' && input.company_id) {
      const cuaKey = datastore.key(['CompanyUserAccount', uid]);
      await datastore.save({
        key: cuaKey,
        data: {
          uid,
          company_id: input.company_id,
          company_key: datastore.key(['Company', input.company_id]),
          user: session.email,
          updated: now,
        },
      });
    }

    // 5. Log the action
    await logAction({
      uid: session.uid,
      email: session.email,
      account_type: session.account_type,
      action: 'USER_CREATE',
      entity_kind: 'UserAccount',
      entity_id: uid,
      after: { email: input.email, account_type: input.account_type, role: input.role },
      success: true,
    });

    return { success: true, data: { uid } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[createUserAction]', message);

    // Firebase Auth error codes — surface meaningful messages
    if (message.includes('email-already-exists')) {
      return { success: false, error: 'An account with this email already exists' };
    }
    if (message.includes('invalid-email')) {
      return { success: false, error: 'Invalid email address' };
    }
    if (message.includes('weak-password')) {
      return { success: false, error: 'Password is too weak' };
    }

    return { success: false, error: 'Failed to create user. Please try again.' };
  }
}

export async function deactivateUserAction(
  targetUid: string
): Promise<ActionResult<void>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };
    if (!targetUid) return { success: false, error: 'Invalid user ID' };
    if (targetUid === session.uid)
      return { success: false, error: 'You cannot deactivate your own account' };

    const admin = getFirebaseAdmin();
    const datastore = getDatastore();
    const now = new Date().toISOString();

    // 1. Disable Firebase Auth account
    await admin.auth().updateUser(targetUid, { disabled: true });

    // 2. Set valid_access: false on UserIAM
    const iamKey = datastore.key(['UserIAM', targetUid]);
    const [iamEntity] = await datastore.get(iamKey);
    if (iamEntity) {
      await datastore.save({
        key: iamKey,
        data: { ...iamEntity, valid_access: false, active: false, updated: now },
      });
    }

    // 3. Set status: false on UserAccount
    const accountKey = datastore.key(['UserAccount', targetUid]);
    const [accountEntity] = await datastore.get(accountKey);
    if (accountEntity) {
      await datastore.save({
        key: accountKey,
        data: { ...accountEntity, status: false, updated: now },
      });
    }

    await logAction({
      uid: session.uid,
      email: session.email,
      account_type: session.account_type,
      action: 'USER_DEACTIVATE',
      entity_kind: 'UserAccount',
      entity_id: targetUid,
      success: true,
    });

    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[deactivateUserAction]', message);
    return { success: false, error: 'Failed to deactivate user. Please try again.' };
  }
}

export async function deleteUserAction(
  targetUid: string
): Promise<ActionResult<void>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };
    if (!targetUid) return { success: false, error: 'Invalid user ID' };
    if (targetUid === session.uid)
      return { success: false, error: 'You cannot delete your own account' };

    const admin = getFirebaseAdmin();
    const datastore = getDatastore();

    // 1. Delete Firebase Auth account
    await admin.auth().deleteUser(targetUid);

    // 2. Delete all Datastore entities for this user
    const keys = [
      datastore.key(['UserAccount', targetUid]),
      datastore.key(['UserIAM', targetUid]),
      datastore.key(['CompanyUserAccount', targetUid]),
      datastore.key(['UserDashboard', targetUid]),
    ];
    await datastore.delete(keys);

    await logAction({
      uid: session.uid,
      email: session.email,
      account_type: session.account_type,
      action: 'USER_DELETE_PERMANENT',
      entity_kind: 'UserAccount',
      entity_id: targetUid,
      success: true,
    });

    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[deleteUserAction]', message);
    return { success: false, error: 'Failed to delete user. Please try again.' };
  }
}

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

    const datastore = getDatastore();
    const now = new Date().toISOString();

    // Update UserAccount (name, phone)
    if (input.first_name !== undefined || input.last_name !== undefined || input.phone_number !== undefined) {
      const accountKey = datastore.key(['UserAccount', targetUid]);
      const [accountEntity] = await datastore.get(accountKey);
      if (accountEntity) {
        const updated = {
          ...accountEntity,
          ...(input.first_name !== undefined && { first_name: input.first_name.trim() }),
          ...(input.last_name !== undefined && { last_name: input.last_name.trim() }),
          ...(input.phone_number !== undefined && { phone_number: input.phone_number.trim() || null }),
          updated: now,
        };
        await datastore.save({ key: accountKey, data: updated });

        // Sync displayName in Firebase Auth
        if (input.first_name !== undefined || input.last_name !== undefined) {
          const admin = getFirebaseAdmin();
          const firstName = input.first_name?.trim() ?? accountEntity.first_name ?? '';
          const lastName = input.last_name?.trim() ?? accountEntity.last_name ?? '';
          await admin.auth().updateUser(targetUid, {
            displayName: `${firstName} ${lastName}`.trim(),
          });
        }
      }
    }

    // Update CompanyUserAccount (company assignment — AFC users only)
    if (input.company_id !== undefined) {
      const cuaKey = datastore.key(['CompanyUserAccount', targetUid]);
      const [cuaEntity] = await datastore.get(cuaKey);
      const companyKey = input.company_id
        ? datastore.key(['Company', input.company_id])
        : null;

      if (cuaEntity) {
        // Update existing record
        await datastore.save({
          key: cuaKey,
          data: {
            ...cuaEntity,
            company_id: input.company_id || null,
            company_key: companyKey,
            updated: now,
          },
        });
      } else if (input.company_id) {
        // Create new CompanyUserAccount if one doesn't exist
        await datastore.save({
          key: cuaKey,
          data: {
            uid: targetUid,
            company_id: input.company_id,
            company_key: companyKey,
            user: session.email,
            updated: now,
          },
        });
      }
    }

    // Update UserIAM (role, valid_access)
    if (input.role !== undefined || input.valid_access !== undefined) {
      const iamKey = datastore.key(['UserIAM', targetUid]);
      const [iamEntity] = await datastore.get(iamKey);
      if (iamEntity) {
        const updated = {
          ...iamEntity,
          ...(input.role !== undefined && { role: input.role }),
          ...(input.valid_access !== undefined && {
            valid_access: input.valid_access,
            active: input.valid_access,
          }),
          updated: now,
        };
        await datastore.save({ key: iamKey, data: updated });

        // Re-enabling access: re-enable Firebase Auth + restore UserAccount status
        if (input.valid_access === true) {
          const admin = getFirebaseAdmin();
          await admin.auth().updateUser(targetUid, { disabled: false });
          const accountKey = datastore.key(['UserAccount', targetUid]);
          const [accountEntity] = await datastore.get(accountKey);
          if (accountEntity && !accountEntity.status) {
            await datastore.save({
              key: accountKey,
              data: { ...accountEntity, status: true, updated: now },
            });
          }
        }
      }
    }

    await logAction({
      uid: session.uid,
      email: session.email,
      account_type: session.account_type,
      action: 'USER_UPDATE',
      entity_kind: 'UserAccount',
      entity_id: targetUid,
      after: input as unknown as Record<string, unknown>,
      success: true,
    });

    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[updateUserAction]', message);
    return { success: false, error: 'Failed to update user. Please try again.' };
  }
}

export async function reactivateUserAction(
  targetUid: string
): Promise<ActionResult<void>> {
  return updateUserAction(targetUid, { valid_access: true });
}

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

    const admin = getFirebaseAdmin();
    await admin.auth().updateUser(targetUid, { password: newPassword });

    await logAction({
      uid: session.uid,
      email: session.email,
      account_type: session.account_type,
      action: 'USER_RESET_PASSWORD',
      entity_kind: 'UserAccount',
      entity_id: targetUid,
      success: true,
    });

    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[resetPasswordAction]', message);
    if (message.includes('weak-password'))
      return { success: false, error: 'Password is too weak. Use at least 8 characters.' };
    return { success: false, error: 'Failed to reset password. Please try again.' };
  }
}
