'use server';

import { verifySessionAndRole } from '@/lib/auth-server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuotationTransportDetail {
  leg: 'first_mile' | 'last_mile';
  vehicle_type_id: string | null;
  address: string;
  area_id?: number | null;
}

export interface CreateQuotationPayload {
  shipment_id: string;
  scope_snapshot: Record<string, string>;
  transport_details: QuotationTransportDetail[];
  notes?: string | null;
}

export interface Quotation {
  id: string;
  quotation_ref: string;
  shipment_id: string;
  status: string;
  revision: number;
  scope_snapshot: Record<string, string>;
  transport_details: QuotationTransportDetail[];
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  scope_changed?: boolean;
  currency?: string;
  company_name?: string | null;
  order_type?: string | null;
  tlx_release?: boolean;
  incoterm?: string | null;
  transaction_type?: string | null;
}

export interface QuotationLineItem {
  id: number;
  quotation_id: string;
  component_type: string;
  charge_code: string;
  description: string;
  uom: string;
  quantity: number;
  price_per_unit: number;
  min_price: number;
  price_currency: string;
  price_conversion: number;
  cost_per_unit: number;
  min_cost: number;
  cost_currency: string;
  cost_conversion: number;
  source_table: string | null;
  source_rate_id: number | null;
  is_manual_override: boolean;
  sort_order: number;
  effective_price: number;
  effective_cost: number;
  margin_percent: number | null;
  tax_code: string | null;
  tax_rate: number;
  tax_amount: number;
  created_at: string;
  updated_at: string | null;
}

export interface LineItemTotals {
  total_price: number;
  total_cost: number;
  total_tax: number;
  margin_percent: number | null;
  currency: string;
}

export interface CalculateResult {
  quotation_ref: string;
  currency: string;
  line_items: QuotationLineItem[];
  warnings: Array<{ component_type: string; message: string }>;
}

export interface ManualLineItemPayload {
  component_type: string;
  charge_code: string;
  description: string;
  uom: string;
  quantity: number;
  price_per_unit: number;
  cost_per_unit: number;
  price_currency: string;
  cost_currency: string;
  min_price: number;
  min_cost: number;
}

export interface LineItemUpdatePayload {
  price_per_unit?: number;
  cost_per_unit?: number;
  quantity?: number;
  description?: string;
  charge_code?: string;
  min_price?: number;
  min_cost?: number;
  uom?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthHeaders(): Promise<{ token: string; serverUrl: string } | null> {
  const { cookies } = await import('next/headers');
  const cookieStore = cookies();
  const idToken = cookieStore.get('af-session')?.value;
  if (!idToken) return null;
  const serverUrl = process.env.AF_SERVER_URL;
  if (!serverUrl) return null;
  return { token: idToken, serverUrl };
}

function extractErrorMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    // Pydantic validation error array: [{loc, msg, type}]
    return detail.map((e: { msg?: string }) => e?.msg ?? JSON.stringify(e)).join('; ');
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail);
  return 'Unknown error';
}

// ---------------------------------------------------------------------------
// Create Quotation
// ---------------------------------------------------------------------------

export async function createQuotationAction(
  payload: CreateQuotationPayload,
): Promise<{ success: true; data: { quotation_ref: string; revision: number } } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(`${auth.serverUrl}/api/v2/quotations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: extractErrorMessage(json?.detail) ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[createQuotationAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to create quotation' };
  }
}

// ---------------------------------------------------------------------------
// List Quotations for a Shipment
// ---------------------------------------------------------------------------

export async function listQuotationsAction(
  shipmentId: string,
): Promise<{ success: true; data: Quotation[] } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(`${auth.serverUrl}/api/v2/quotations?shipment_id=${encodeURIComponent(shipmentId)}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: extractErrorMessage(json?.detail) ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[listQuotationsAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to list quotations' };
  }
}

// ---------------------------------------------------------------------------
// Get Single Quotation
// ---------------------------------------------------------------------------

export async function getQuotationAction(
  ref: string,
): Promise<{ success: true; data: Quotation } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(`${auth.serverUrl}/api/v2/quotations/${encodeURIComponent(ref)}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: extractErrorMessage(json?.detail) ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[getQuotationAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to load quotation' };
  }
}

// ---------------------------------------------------------------------------
// List All Quotations (no shipment filter)
// ---------------------------------------------------------------------------

export async function listAllQuotationsAction(): Promise<
  { success: true; data: Quotation[] } | { success: false; error: string }
> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(`${auth.serverUrl}/api/v2/quotations`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: extractErrorMessage(json?.detail) ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[listAllQuotationsAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to list quotations' };
  }
}

// ---------------------------------------------------------------------------
// Calculate Quotation Pricing
// ---------------------------------------------------------------------------

export async function calculateQuotationAction(
  ref: string,
): Promise<{ success: true; data: CalculateResult } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(`${auth.serverUrl}/api/v2/quotations/${encodeURIComponent(ref)}/calculate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: extractErrorMessage(json?.detail) ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[calculateQuotationAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to calculate pricing' };
  }
}

// ---------------------------------------------------------------------------
// List Line Items
// ---------------------------------------------------------------------------

export async function listLineItemsAction(
  ref: string,
): Promise<{ success: true; data: { line_items: QuotationLineItem[]; totals: LineItemTotals } } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(`${auth.serverUrl}/api/v2/quotations/${encodeURIComponent(ref)}/line-items`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: extractErrorMessage(json?.detail) ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[listLineItemsAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to load line items' };
  }
}

// ---------------------------------------------------------------------------
// Add Manual Line Item
// ---------------------------------------------------------------------------

export async function addManualLineItemAction(
  ref: string,
  payload: ManualLineItemPayload,
): Promise<{ success: true; data: { message: string } } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(`${auth.serverUrl}/api/v2/quotations/${encodeURIComponent(ref)}/line-items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: extractErrorMessage(json?.detail) ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[addManualLineItemAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to add line item' };
  }
}

// ---------------------------------------------------------------------------
// Update Line Item
// ---------------------------------------------------------------------------

export async function updateLineItemAction(
  ref: string,
  itemId: number,
  payload: LineItemUpdatePayload,
): Promise<{ success: true; data: { message: string } } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(`${auth.serverUrl}/api/v2/quotations/${encodeURIComponent(ref)}/line-items/${itemId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: extractErrorMessage(json?.detail) ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[updateLineItemAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to update line item' };
  }
}

// ---------------------------------------------------------------------------
// Area Lookup
// ---------------------------------------------------------------------------

export interface AreaInfo {
  area_id: number;
  area_name: string;
  state_code: string;
  state_name: string;
}

export async function fetchAreasAction(
  ids: number[],
): Promise<{ success: true; data: AreaInfo[] } | { success: false; error: string }> {
  try {
    if (ids.length === 0) return { success: true, data: [] };

    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(`${auth.serverUrl}/api/v2/geography/areas?ids=${ids.join(',')}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: extractErrorMessage(json?.detail) ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[fetchAreasAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to fetch areas' };
  }
}

// ---------------------------------------------------------------------------
// Delete Line Item
// ---------------------------------------------------------------------------

export async function deleteLineItemAction(
  ref: string,
  itemId: number,
): Promise<{ success: true; data: { message: string } } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(`${auth.serverUrl}/api/v2/quotations/${encodeURIComponent(ref)}/line-items/${itemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: extractErrorMessage(json?.detail) ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[deleteLineItemAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to delete line item' };
  }
}

// ---------------------------------------------------------------------------
// Set TLX Release
// ---------------------------------------------------------------------------

export async function setTlxReleaseAction(
  ref: string,
  tlxRelease: boolean,
): Promise<{ success: true; data: { tlx_release: boolean; scope_changed: boolean } } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(`${auth.serverUrl}/api/v2/quotations/${encodeURIComponent(ref)}/tlx-release`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tlx_release: tlxRelease }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: extractErrorMessage(json?.detail) ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[setTlxReleaseAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to update telex release' };
  }
}

// ---------------------------------------------------------------------------
// Update Quotation Scope Snapshot
// ---------------------------------------------------------------------------

export async function updateQuotationScopeSnapshotAction(
  quotationRef: string,
  scopeSnapshot: Record<string, string>,
): Promise<{ success: true; data: { quotation_ref: string } } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(`${auth.serverUrl}/api/v2/quotations/${encodeURIComponent(quotationRef)}/scope-snapshot`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope_snapshot: scopeSnapshot }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: extractErrorMessage(json?.detail) ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[updateQuotationScopeSnapshotAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to update scope snapshot' };
  }
}
