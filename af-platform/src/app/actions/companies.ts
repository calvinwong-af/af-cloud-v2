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

import { getCompanies, getCompanyById, getCompanyStats, getCompanyUsers } from '@/lib/companies';
import { createCompany, updateCompany, deleteCompany } from '@/lib/companies-write';
import type { CreateCompanyInput, UpdateCompanyInput } from '@/lib/companies-write';
import type { CompanyUser } from '@/lib/companies';
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

// ---------------------------------------------------------------------------
// Company users
// ---------------------------------------------------------------------------

export async function fetchCompanyUsersAction(
  companyId: string
): Promise<ActionResult<CompanyUser[]>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFC-ADMIN', 'AFC-M']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const users = await getCompanyUsers(companyId);
    return { success: true, data: users };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[fetchCompanyUsersAction]', message);
    return { success: false, error: 'Failed to load company users.' };
  }
}

// ---------------------------------------------------------------------------
// Company shipments
// ---------------------------------------------------------------------------

export async function fetchCompanyShipmentsAction(
  companyId: string,
  offset: number = 0
): Promise<ActionResult<{ shipments: import('@/app/actions/shipments').ShipmentListItem[]; next_cursor: string | null; total: number }>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFC-ADMIN', 'AFC-M']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) return { success: false, error: 'No session token' };

    const url = new URL('/api/v2/shipments', process.env.AF_SERVER_URL);
    url.searchParams.set('tab', 'all');
    url.searchParams.set('company_id', companyId);
    url.searchParams.set('limit', '20');
    if (offset > 0) url.searchParams.set('offset', String(offset));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) return { success: false, error: `Server responded ${res.status}` };

    const json = await res.json();
    return {
      success: true,
      data: {
        shipments: json.shipments ?? [],
        next_cursor: json.next_cursor ?? null,
        total: json.total ?? 0,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[fetchCompanyShipmentsAction]', message);
    return { success: false, error: 'Failed to load company shipments.' };
  }
}

// ---------------------------------------------------------------------------
// Create company
// ---------------------------------------------------------------------------

export async function createCompanyAction(
  input: CreateCompanyInput
): Promise<ActionResult<Company>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const company = await createCompany(input, session.email);

    await logAction({
      uid: session.uid,
      email: session.email,
      account_type: session.account_type,
      action: 'COMPANY_CREATE',
      entity_kind: 'Company',
      entity_id: company.company_id,
      success: true,
    });

    return { success: true, data: company };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[createCompanyAction]', message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Update company
// ---------------------------------------------------------------------------

export async function updateCompanyAction(
  companyId: string,
  input: UpdateCompanyInput
): Promise<ActionResult<Company>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    if (!companyId?.match(/^AFC-\d+$/)) {
      return { success: false, error: 'Invalid company ID format' };
    }

    const company = await updateCompany(companyId, input);

    await logAction({
      uid: session.uid,
      email: session.email,
      account_type: session.account_type,
      action: 'COMPANY_UPDATE',
      entity_kind: 'Company',
      entity_id: companyId,
      success: true,
    });

    return { success: true, data: company };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[updateCompanyAction]', message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Delete company (soft-delete → trash: true)
// ---------------------------------------------------------------------------

export async function deleteCompanyAction(
  companyId: string
): Promise<ActionResult<{ deleted: true }>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    if (!companyId?.match(/^AFC-\d+$/)) {
      return { success: false, error: 'Invalid company ID format' };
    }

    await deleteCompany(companyId);

    await logAction({
      uid: session.uid,
      email: session.email,
      account_type: session.account_type,
      action: 'COMPANY_DELETE',
      entity_kind: 'Company',
      entity_id: companyId,
      success: true,
    });

    return { success: true, data: { deleted: true } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[deleteCompanyAction]', message);
    return { success: false, error: message };
  }
}
