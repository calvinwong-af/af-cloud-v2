'use server';

import { verifySessionAndRole } from '@/lib/auth-server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GroundTransportLeg {
  leg_id?: number;
  transport_order_id?: string;
  leg_sequence: number;
  leg_type: 'delivery' | 'pickup' | 'transfer' | 'return';
  origin_city_id?: number | null;
  origin_haulage_area_id?: number | null;
  origin_address_line?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  dest_city_id?: number | null;
  dest_haulage_area_id?: number | null;
  dest_address_line?: string | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
  scheduled_date?: string | null;
  actual_date?: string | null;
  status?: string;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GroundTransportOrder {
  transport_order_id: string;
  transport_type: 'haulage' | 'trucking';
  leg_type: 'first_mile' | 'last_mile' | 'standalone' | 'distribution';
  parent_shipment_id: string | null;
  vendor_id: string | null;
  status: string;
  cargo_description: string | null;
  container_numbers: string[];
  weight_kg: number | null;
  volume_cbm: number | null;
  driver_name: string | null;
  driver_contact: string | null;
  vehicle_plate: string | null;
  equipment_type: string | null;
  equipment_number: string | null;
  detention_mode: string | null;
  detention_free_days: number | null;
  container_yard_id: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  legs?: GroundTransportLeg[];
}

export interface ScopeFlags {
  first_mile_haulage: boolean;
  first_mile_trucking: boolean;
  export_clearance: boolean;
  sea_freight: boolean;
  import_clearance: boolean;
  last_mile_haulage: boolean;
  last_mile_trucking: boolean;
}

export interface ReconcileResult {
  scope: ScopeFlags;
  orders: GroundTransportOrder[];
  gaps: string[];
}

export interface GeocodeResult {
  lat: number | null;
  lng: number | null;
  formatted_address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
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
// Create Ground Transport Order
// ---------------------------------------------------------------------------

export interface GroundTransportCreatePayload {
  transport_type: 'haulage' | 'trucking';
  leg_type: 'first_mile' | 'last_mile' | 'standalone' | 'distribution';
  parent_shipment_id?: string | null;
  vendor_id?: string | null;
  cargo_description?: string | null;
  container_numbers?: string[];
  weight_kg?: number | null;
  volume_cbm?: number | null;
  driver_name?: string | null;
  driver_contact?: string | null;
  vehicle_plate?: string | null;
  equipment_type?: string | null;
  equipment_number?: string | null;
  detention_mode?: 'direct' | 'detained' | null;
  detention_free_days?: number | null;
  container_yard_id?: number | null;
  notes?: string | null;
  legs?: GroundTransportLeg[];
}

export async function createGroundTransportOrderAction(
  payload: GroundTransportCreatePayload,
): Promise<{ success: true; data: GroundTransportOrder } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(`${auth.serverUrl}/api/v2/ground-transport`, {
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
    console.error('[createGroundTransportOrderAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to create ground transport order' };
  }
}

// ---------------------------------------------------------------------------
// List Ground Transport Orders
// ---------------------------------------------------------------------------

export async function listGroundTransportOrdersAction(
  filters?: { transport_type?: string; status?: string; parent_shipment_id?: string },
): Promise<{ success: true; data: GroundTransportOrder[] } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const url = new URL('/api/v2/ground-transport', auth.serverUrl);
    if (filters?.transport_type) url.searchParams.set('transport_type', filters.transport_type);
    if (filters?.status) url.searchParams.set('status', filters.status);
    if (filters?.parent_shipment_id) url.searchParams.set('parent_shipment_id', filters.parent_shipment_id);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data ?? [] };
  } catch (err) {
    console.error('[listGroundTransportOrdersAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to list ground transport orders' };
  }
}

// ---------------------------------------------------------------------------
// Get Single Ground Transport Order
// ---------------------------------------------------------------------------

export async function getGroundTransportOrderAction(
  transportOrderId: string,
): Promise<{ success: true; data: GroundTransportOrder } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(
      `${auth.serverUrl}/api/v2/ground-transport/${encodeURIComponent(transportOrderId)}`,
      { headers: { Authorization: `Bearer ${auth.token}` }, cache: 'no-store' },
    );

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[getGroundTransportOrderAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to get ground transport order' };
  }
}

// ---------------------------------------------------------------------------
// Update Ground Transport Order
// ---------------------------------------------------------------------------

export async function updateGroundTransportOrderAction(
  transportOrderId: string,
  payload: Partial<Omit<GroundTransportOrder, 'transport_order_id' | 'created_at' | 'updated_at' | 'created_by' | 'legs'>>,
): Promise<{ success: true; data: GroundTransportOrder } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(
      `${auth.serverUrl}/api/v2/ground-transport/${encodeURIComponent(transportOrderId)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[updateGroundTransportOrderAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to update ground transport order' };
  }
}

// ---------------------------------------------------------------------------
// Cancel Ground Transport Order
// ---------------------------------------------------------------------------

export async function cancelGroundTransportOrderAction(
  transportOrderId: string,
): Promise<{ success: true; data: GroundTransportOrder } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(
      `${auth.serverUrl}/api/v2/ground-transport/${encodeURIComponent(transportOrderId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` }, cache: 'no-store' },
    );

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[cancelGroundTransportOrderAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to cancel ground transport order' };
  }
}

// ---------------------------------------------------------------------------
// Add Leg
// ---------------------------------------------------------------------------

export async function addLegAction(
  transportOrderId: string,
  leg: GroundTransportLeg,
): Promise<{ success: true; data: GroundTransportLeg[] } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(
      `${auth.serverUrl}/api/v2/ground-transport/${encodeURIComponent(transportOrderId)}/legs`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(leg),
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data ?? [] };
  } catch (err) {
    console.error('[addLegAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to add leg' };
  }
}

// ---------------------------------------------------------------------------
// Update Leg
// ---------------------------------------------------------------------------

export async function updateLegAction(
  transportOrderId: string,
  legId: number,
  payload: Partial<GroundTransportLeg>,
): Promise<{ success: true; data: GroundTransportLeg[] } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(
      `${auth.serverUrl}/api/v2/ground-transport/${encodeURIComponent(transportOrderId)}/legs/${legId}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data ?? [] };
  } catch (err) {
    console.error('[updateLegAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to update leg' };
  }
}

// ---------------------------------------------------------------------------
// Reconcile Shipment Ground Transport
// ---------------------------------------------------------------------------

export async function reconcileShipmentGroundTransportAction(
  shipmentId: string,
): Promise<{ success: true; data: ReconcileResult } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(
      `${auth.serverUrl}/api/v2/ground-transport/shipment/${encodeURIComponent(shipmentId)}/reconcile`,
      { headers: { Authorization: `Bearer ${auth.token}` }, cache: 'no-store' },
    );

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[reconcileShipmentGroundTransportAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to reconcile ground transport' };
  }
}

// ---------------------------------------------------------------------------
// Update Shipment Scope
// ---------------------------------------------------------------------------

export async function updateShipmentScopeAction(
  shipmentId: string,
  scope: Partial<ScopeFlags>,
): Promise<{ success: true; data: ScopeFlags } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(
      `${auth.serverUrl}/api/v2/ground-transport/shipment/${encodeURIComponent(shipmentId)}/scope`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(scope),
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[updateShipmentScopeAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to update shipment scope' };
  }
}

// ---------------------------------------------------------------------------
// Geocode Address
// ---------------------------------------------------------------------------

export async function geocodeAddressAction(
  address: string,
): Promise<{ success: true; data: GeocodeResult } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const url = new URL('/api/v2/ground-transport/geocode', auth.serverUrl);
    url.searchParams.set('address', address);

    const res = await fetch(url.toString(), {
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
    console.error('[geocodeAddressAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to geocode address' };
  }
}
