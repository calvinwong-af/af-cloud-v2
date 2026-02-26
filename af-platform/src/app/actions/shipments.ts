'use server';
/**
 * AcceleFreight Platform — ShipmentOrders Server Actions
 *
 * Server-side only. Enforces auth + RBAC.
 * Read-only for now — write (create/update) actions come in the next phase.
 */

import { getShipmentOrders, getShipmentOrderDetail } from '@/lib/shipments';
import { verifySessionAndRole, logAction } from '@/lib/auth-server';
import { getDatastore } from '@/lib/datastore-query';
import { getCompanies } from '@/lib/companies';
import type { ShipmentOrder, OrderType, ShipmentOrderStatus } from '@/lib/types';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function fetchShipmentOrdersAction(options?: {
  companyId?: string;
  status?: ShipmentOrderStatus[];
  orderType?: OrderType[];
  limit?: number;
  cursor?: string;
}): Promise<ActionResult<{ orders: ShipmentOrder[]; nextCursor: string | null }>> {
  try {
    // AFC staff and Admin can see all orders
    // AFU users can only see their own company's orders (enforced by companyId check below)
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    // AFC and AFU-ADMIN (internal staff) can see all orders
    // AFU customers are scoped to their own company only
    let companyId = options?.companyId;
    const isCustomer = session.account_type === 'AFC';
    if (isCustomer) {
      if (!session.company_id) {
        return { success: false, error: 'No company associated with this account' };
      }
      companyId = session.company_id;
    }

    const result = await getShipmentOrders({
      companyId,
      status: options?.status,
      orderType: options?.orderType,
      limit: options?.limit ?? 50,
      cursor: options?.cursor,
      excludeTrash: true,
      excludeChildren: true,
    });

    return { success: true, data: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[fetchShipmentOrdersAction]', message);
    return { success: false, error: 'Failed to load shipment orders. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function fetchShipmentOrderDetailAction(
  quotationId: string
): Promise<ActionResult<ShipmentOrder>> {
  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    if (!quotationId?.match(/^(AFCQ|AF2)-\d+$/)) {
      return { success: false, error: 'Invalid shipment order ID format' };
    }

    const order = await getShipmentOrderDetail(quotationId);
    if (!order) {
      return { success: false, error: `Shipment order ${quotationId} not found` };
    }

    // AFC customers can only see their own company's orders
    if (session.account_type === 'AFC' && order.company_id !== session.company_id) {
      return { success: false, error: 'Not found' };  // Don't reveal it exists
    }

    await logAction({
      uid: session.uid,
      email: session.email,
      account_type: session.account_type,
      action: 'SHIPMENT_ORDER_VIEW',
      entity_kind: 'Quotation',
      entity_id: quotationId,
      success: true,
    });

    return { success: true, data: order };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[fetchShipmentOrderDetailAction]', message);
    return { success: false, error: 'Failed to load shipment order. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// List (via af-server) — replaces in-memory Datastore query for shipments page
// ---------------------------------------------------------------------------

export interface ShipmentListItem {
  shipment_id: string;
  data_version: number;
  status: number;
  order_type: string;
  transaction_type: string;
  incoterm: string;
  origin_port: string;
  destination_port: string;
  company_id: string;
  company_name: string;
  cargo_ready_date: string | null;
  updated: string;
}

export async function getShipmentListAction(
  tab: string = 'active',
  cursor?: string | null,
  limit: number = 25,
): Promise<{
  shipments: ShipmentListItem[];
  next_cursor: string | null;
  total_shown: number;
}> {
  const empty = { shipments: [], next_cursor: null, total_shown: 0 };

  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) return empty;

    // Get Firebase ID token from session cookie to forward to af-server
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) return empty;

    const url = new URL('/api/v2/shipments', process.env.AF_SERVER_URL);
    url.searchParams.set('tab', tab);
    url.searchParams.set('limit', String(limit));
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('[getShipmentListAction] af-server responded', res.status);
      return empty;
    }

    const json = await res.json();
    return {
      shipments: json.shipments ?? [],
      next_cursor: json.next_cursor ?? null,
      total_shown: json.total_shown ?? 0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[getShipmentListAction]', message);
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Stats (dashboard)
// ---------------------------------------------------------------------------

export async function fetchShipmentOrderStatsAction(
  companyId?: string
): Promise<ActionResult<{
  total: number;
  active: number;
  completed: number;
  to_invoice: number;
  draft: number;
  cancelled: number;
}>> {
  const zeroed = { total: 0, active: 0, completed: 0, to_invoice: 0, draft: 0, cancelled: 0 };

  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    // Get Firebase ID token from session cookie to forward to af-server
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) {
      return { success: true, data: zeroed };
    }

    // AFC customers: scope to own company
    const scopedCompanyId =
      session.account_type === 'AFC' ? session.company_id ?? undefined : companyId;

    const url = new URL('/api/v2/shipments/stats', process.env.AF_SERVER_URL);
    if (scopedCompanyId) {
      url.searchParams.set('company_id', scopedCompanyId);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('[fetchShipmentOrderStatsAction] af-server responded', res.status);
      return { success: true, data: zeroed };
    }

    const json = await res.json();
    const d = json.data ?? {};

    return {
      success: true,
      data: {
        total: d.total ?? 0,
        active: d.active ?? 0,
        completed: d.completed ?? 0,
        to_invoice: d.to_invoice ?? 0,
        draft: d.draft ?? 0,
        cancelled: d.cancelled ?? 0,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[fetchShipmentOrderStatsAction]', message);
    return { success: true, data: zeroed };
  }
}

// ---------------------------------------------------------------------------
// Lightweight company list for shipment creation modal
// Returns only company_id + name for the dropdown selector
// ---------------------------------------------------------------------------

export async function fetchCompaniesForShipmentAction(): Promise<{ company_id: string; name: string }[]> {
  const session = await verifySessionAndRole(['AFU-ADMIN']);
  if (!session.valid) return [];

  try {
    const companies = await getCompanies();
    return companies
      .filter((c) => !c.trash)
      .map((c) => ({ company_id: c.company_id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch all ports from Datastore for the shipment creation form
// ---------------------------------------------------------------------------

export async function fetchPortsAction(): Promise<{ un_code: string; name: string; country: string; port_type: string }[]> {
  const session = await verifySessionAndRole(['AFU-ADMIN']);
  if (!session.valid) return [];

  try {
    const datastore = getDatastore();
    const query = datastore.createQuery('Port');
    const [entities] = await datastore.runQuery(query);

    type PortRow = { un_code: string; name: string; country: string; port_type: string };

    return (entities as Record<string, unknown>[])
      .map((e): PortRow => ({
        un_code: (e.un_code ?? '').toString().trim(),
        // Port Kind may use 'name' or 'port_name' — check both
        name: (e.name ?? e.port_name ?? e.un_code ?? '').toString().trim(),
        country: (e.country ?? '').toString().trim(),
        port_type: (e.port_type ?? '').toString().trim(),
      }))
      .filter((p) => p.un_code.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Get current session account type (lightweight — for UI role guards)
// ---------------------------------------------------------------------------

export async function getSessionAccountTypeAction(): Promise<string | null> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF', 'AFC-ADMIN', 'AFC-M']);
    if (!session.valid) return null;
    return session.account_type;
  } catch {
    return null;
  }
}
