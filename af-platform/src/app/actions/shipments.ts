'use server';
/**
 * AcceleFreight Platform — ShipmentOrders Server Actions
 *
 * Server-side only. Enforces auth + RBAC.
 * Read-only for now — write (create/update) actions come in the next phase.
 */

import { verifySessionAndRole } from '@/lib/auth-server';
import { getCompanies } from '@/lib/companies';
import type { ShipmentOrder } from '@/lib/types';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Detail (via af-server)
// ---------------------------------------------------------------------------

export async function fetchShipmentOrderDetailAction(
  quotationId: string
): Promise<ActionResult<ShipmentOrder>> {
  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    if (!quotationId?.match(/^(AFCQ|AF2|AF)-\d+$/)) {
      return { success: false, error: 'Invalid shipment order ID format' };
    }

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) {
      return { success: false, error: 'No session token' };
    }

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(quotationId)}`,
      process.env.AF_SERVER_URL
    );
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { success: false, error: `Shipment order ${quotationId} not found` };
      }
      return { success: false, error: `Server responded ${res.status}` };
    }

    const json = await res.json();
    const data = json.data;
    if (!data) {
      return { success: false, error: `Shipment order ${quotationId} not found` };
    }

    // AFC customers can only see their own company's orders
    if (session.account_type === 'AFC' && data.company_id !== session.company_id) {
      return { success: false, error: 'Not found' };
    }

    // Normalize fields that the PostgreSQL API doesn't include but the UI expects
    const normalized: ShipmentOrder = {
      ...data,
      customs_clearance: data.customs_clearance ?? [],
      files: data.files ?? [],
      related_orders: data.related_orders ?? [],
      commercial_quotation_ids: data.commercial_quotation_ids ?? [],
      status_history: data.status_history ?? [],
      _company_name: data.company_name ?? data._company_name,
    };

    return { success: true, data: normalized };
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
  migrated_from_v1?: boolean;
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
  issued_invoice?: boolean;
}

export async function getShipmentListAction(
  tab: string = 'active',
  offset: number = 0,
  limit: number = 25,
): Promise<{
  shipments: ShipmentListItem[];
  next_cursor: string | null;
  total: number;
}> {
  const empty = { shipments: [], next_cursor: null, total: 0 };

  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) return empty;

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) return empty;

    const url = new URL('/api/v2/shipments', process.env.AF_SERVER_URL);
    url.searchParams.set('tab', tab);
    url.searchParams.set('limit', String(limit));
    if (offset > 0) {
      url.searchParams.set('offset', String(offset));
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
      total: json.total ?? 0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[getShipmentListAction] ERROR:', message);
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Search (via af-server)
// ---------------------------------------------------------------------------

export interface SearchResult {
  shipment_id: string;
  data_version: number;
  migrated_from_v1?: boolean;
  status: number;
  status_label: string;
  order_type: string;
  transaction_type: string;
  incoterm: string;
  company_id: string;
  company_name: string;
  origin_port: string;
  destination_port: string;
  cargo_ready_date: string;
  updated: string;
  issued_invoice?: boolean;
}

export async function searchShipmentsAction(
  q: string,
  searchFields: 'id' | 'all' = 'id',
  limit: number = 8,
): Promise<SearchResult[]> {
  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) return [];

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) return [];

    const url = new URL('/api/v2/shipments/search', process.env.AF_SERVER_URL);
    url.searchParams.set('q', q);
    url.searchParams.set('search_fields', searchFields);
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('[searchShipmentsAction] af-server responded', res.status);
      return [];
    }

    const json = await res.json();
    return json.results ?? [];
  } catch (err) {
    console.error('[searchShipmentsAction]', err instanceof Error ? err.message : err);
    return [];
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

export interface PortWithTerminals {
  un_code: string;
  name: string;
  country: string;
  port_type: string;
  has_terminals: boolean;
  terminals: Array<{ terminal_id: string; name: string; is_default: boolean }>;
}

export async function fetchPortsAction(): Promise<PortWithTerminals[]> {
  const session = await verifySessionAndRole(['AFU-ADMIN']);
  if (!session.valid) return [];

  try {
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) return [];

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) return [];

    const url = new URL('/api/v2/geography/ports', serverUrl);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) return [];

    const json = await res.json();
    return (json.data ?? []) as PortWithTerminals[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Reassign company (via af-server)
// ---------------------------------------------------------------------------

export async function reassignShipmentCompanyAction(
  shipmentId: string,
  companyId: string
): Promise<ActionResult<{ company_id: string; company_name: string }>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised — staff only' };
    }

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) {
      return { success: false, error: 'No session token' };
    }

    const url = new URL(`/api/v2/shipments/${encodeURIComponent(shipmentId)}/company`, process.env.AF_SERVER_URL);
    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ company_id: companyId }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.detail ?? json?.msg ?? `Server responded ${res.status}`;
      return { success: false, error: msg };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[reassignShipmentCompanyAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to reassign company' };
  }
}

// ---------------------------------------------------------------------------
// Status history (via af-server)
// ---------------------------------------------------------------------------

export interface StatusHistoryEntry {
  status: number;
  status_label: string;
  timestamp: string;
  changed_by: string;
}

export async function fetchStatusHistoryAction(
  shipmentId: string
): Promise<StatusHistoryEntry[]> {
  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) return [];

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) return [];

    const url = new URL(`/api/v2/shipments/${encodeURIComponent(shipmentId)}/status-history`, process.env.AF_SERVER_URL);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) return [];

    const json = await res.json();
    return json.history ?? [];
  } catch (err) {
    console.error('[fetchStatusHistoryAction]', err instanceof Error ? err.message : err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Dashboard — Active + To Invoice (via af-server)
// ---------------------------------------------------------------------------

export async function fetchDashboardShipmentsAction(): Promise<ActionResult<{
  active: ShipmentListItem[];
  to_invoice: ShipmentListItem[];
}>> {
  const empty = { active: [], to_invoice: [] };

  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) {
      return { success: true, data: empty };
    }

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) {
      return { success: false, error: 'Server URL not configured' };
    }

    // AFC customers: scope to own company
    const isCustomer = session.account_type === 'AFC';
    const companyParam = isCustomer ? session.company_id : undefined;

    const activeUrl = new URL('/api/v2/shipments', serverUrl);
    activeUrl.searchParams.set('tab', 'active');
    activeUrl.searchParams.set('limit', '24');
    if (companyParam) activeUrl.searchParams.set('company_id', companyParam);

    const invoiceUrl = new URL('/api/v2/shipments', serverUrl);
    invoiceUrl.searchParams.set('tab', 'to_invoice');
    invoiceUrl.searchParams.set('limit', '8');
    if (companyParam) invoiceUrl.searchParams.set('company_id', companyParam);

    const headers = { Authorization: `Bearer ${idToken}` };

    const [activeRes, invoiceRes] = await Promise.all([
      fetch(activeUrl.toString(), { headers, cache: 'no-store' }),
      fetch(invoiceUrl.toString(), { headers, cache: 'no-store' }),
    ]);

    if (!activeRes.ok || !invoiceRes.ok) {
      console.error('[fetchDashboardShipmentsAction] af-server responded', activeRes.status, invoiceRes.status);
      return { success: true, data: empty };
    }

    const [activeJson, invoiceJson] = await Promise.all([
      activeRes.json(),
      invoiceRes.json(),
    ]);

    return {
      success: true,
      data: {
        active: activeJson.shipments ?? [],
        to_invoice: invoiceJson.shipments ?? [],
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[fetchDashboardShipmentsAction]', message);
    return { success: false, error: 'Failed to load dashboard shipments' };
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
