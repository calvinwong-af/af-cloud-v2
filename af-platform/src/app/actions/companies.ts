'use server';
/**
 * AcceleFreight Platform — Companies Server Actions
 *
 * All functions run server-side only (Next.js Server Actions).
 * Enforces Firebase Auth verification + RBAC before any Datastore access.
 *
 * Three Core Pillars:
 * 1. Process logging → AFSystemLogs
 * 2. Error handling  → try/catch, user-facing messages
 * 3. Security        → token verify, role check
 */

import { getCompanies, getCompanyById, getCompanyStats } from '@/lib/companies';
import { verifySessionAndRole, logAction } from '@/lib/auth-server';
import type { Company } from '@/lib/types';

// ---------------------------------------------------------------------------
// Action result wrapper
// ---------------------------------------------------------------------------

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Fetch companies list
// ---------------------------------------------------------------------------

export async function fetchCompaniesAction(options?: {
  search?: string;
  limit?: number;
}): Promise<ActionResult<Company[]>> {
  try {
    // Auth: AFC staff or Admin can view all companies
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const companies = await getCompanies({
      search: options?.search,
      limit: options?.limit ?? 200,
      excludeTrash: true,
    });

    await logAction({
      uid: session.uid,
      email: session.email,
      account_type: session.account_type,
      action: 'COMPANIES_LIST',
      entity_kind: 'Company',
      entity_id: '*',
      success: true,
    });

    return { success: true, data: companies };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[fetchCompaniesAction]', message);
    return { success: false, error: 'Failed to load companies. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// Fetch single company
// ---------------------------------------------------------------------------

export async function fetchCompanyAction(
  companyId: string
): Promise<ActionResult<Company>> {
  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    if (!companyId?.match(/^AFC-\d+$/)) {
      return { success: false, error: 'Invalid company ID format' };
    }

    const company = await getCompanyById(companyId);
    if (!company) {
      return { success: false, error: `Company ${companyId} not found` };
    }

    return { success: true, data: company };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[fetchCompanyAction]', message);
    return { success: false, error: 'Failed to load company. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// Fetch stats (dashboard)
// ---------------------------------------------------------------------------

export async function fetchCompanyStatsAction(): Promise<
  ActionResult<{ total: number; approved: number; with_access: number; xero_synced: number }>
> {
  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const stats = await getCompanyStats();
    return { success: true, data: stats };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[fetchCompanyStatsAction] FULL ERROR:', err);
    return { success: false, error: message };
  }
}
