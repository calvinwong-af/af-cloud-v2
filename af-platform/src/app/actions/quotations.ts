'use server';

import { verifySessionAndRole } from '@/lib/auth-server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuotationTransportDetail {
  leg: 'first_mile' | 'last_mile';
  vehicle_type_id: string;
  address: string;
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
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
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
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[listQuotationsAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to list quotations' };
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
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[listAllQuotationsAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to list quotations' };
  }
}
