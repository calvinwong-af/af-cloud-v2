'use server';

import { verifySessionAndRole } from '@/lib/auth-server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderStop {
  stop_id: number;
  order_id: string;
  sequence: number;
  stop_type: 'pickup' | 'dropoff' | 'waypoint';
  address_line: string | null;
  area_id: number | null;
  area_name: string | null;
  lat: number | null;
  lng: number | null;
  scheduled_arrival: string | null;
  actual_arrival: string | null;
  notes: string | null;
}

export interface OrderLeg {
  leg_id: number;
  order_id: string;
  from_stop_id: number;
  to_stop_id: number;
  sequence: number;
  driver_name: string | null;
  driver_contact: string | null;
  vehicle_plate: string | null;
  vehicle_type_id: string | null;
  equipment_type: string | null;
  equipment_number: string | null;
  status: string;
  notes: string | null;
}

export interface VehicleType {
  vehicle_type_id: string;
  label: string;
  category: string;
  sort_order: number;
}

export interface GroundTransportOrder {
  order_id: string;
  transport_type: 'haulage' | 'port' | 'general' | 'cross_border';
  leg_type: 'first_mile' | 'last_mile' | 'standalone' | 'distribution';
  parent_shipment_id: string | null;
  task_ref: string | null;
  vendor_id: string | null;
  status: string;
  sub_status: string | null;
  cargo_description: string | null;
  container_numbers: string[];
  weight_kg: number | null;
  volume_cbm: number | null;
  detention_mode: string | null;
  detention_free_days: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_test?: boolean;
  trash?: boolean;
  stops: OrderStop[];
  legs: OrderLeg[];
}

export interface ScopeFlags {
  first_mile:        'ASSIGNED' | 'TRACKED' | 'IGNORED';
  export_clearance:  'ASSIGNED' | 'TRACKED' | 'IGNORED';
  import_clearance:  'ASSIGNED' | 'TRACKED' | 'IGNORED';
  last_mile:         'ASSIGNED' | 'TRACKED' | 'IGNORED';
  freight:           'ASSIGNED' | 'TRACKED' | 'IGNORED';
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

export interface NearestAreaResult {
  area_id: number;
  area_code: string;
  area_name: string;
  state_code: string;
  lat: number;
  lng: number;
  distance_km: number;
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
  transport_type: 'haulage' | 'port' | 'general';
  leg_type: 'first_mile' | 'last_mile' | 'standalone' | 'distribution';
  parent_shipment_id?: string | null;
  task_ref?: string | null;
  vendor_id?: string | null;
  cargo_description?: string | null;
  container_numbers?: string[];
  weight_kg?: number | null;
  volume_cbm?: number | null;
  detention_mode?: 'direct' | 'detained' | null;
  detention_free_days?: number | null;
  notes?: string | null;
  stops?: Partial<OrderStop>[];
  is_test?: boolean;
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
  filters?: { transport_type?: string; status?: string; parent_shipment_id?: string; task_ref?: string },
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
    if (filters?.task_ref) url.searchParams.set('task_ref', filters.task_ref);

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
  payload: Partial<Omit<GroundTransportOrder, 'order_id' | 'created_at' | 'updated_at' | 'created_by' | 'stops' | 'legs'>>,
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
// Delete Ground Transport Order (soft/hard)
// ---------------------------------------------------------------------------

export async function deleteGroundTransportOrderAction(
  orderId: string,
  hard: boolean = false,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const url = `${auth.serverUrl}/api/v2/ground-transport/${encodeURIComponent(orderId)}/delete?hard=${hard}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.detail || `Delete failed: ${res.status}` };
    }

    return { success: true };
  } catch (e) {
    console.error('[deleteGroundTransportOrderAction]', e instanceof Error ? e.message : e);
    return { success: false, error: 'Delete failed' };
  }
}

// ---------------------------------------------------------------------------
// Add Stop
// ---------------------------------------------------------------------------

export async function addStopAction(
  orderId: string,
  stop: Partial<OrderStop>,
): Promise<{ success: true; data: OrderStop[] } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(
      `${auth.serverUrl}/api/v2/ground-transport/${encodeURIComponent(orderId)}/stops`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(stop),
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
    console.error('[addStopAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to add stop' };
  }
}

// ---------------------------------------------------------------------------
// Update Stop
// ---------------------------------------------------------------------------

export async function updateStopAction(
  orderId: string,
  stopId: number,
  stop: Partial<OrderStop>,
): Promise<{ success: true; data: { stops: OrderStop[]; legs: OrderLeg[] } } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(
      `${auth.serverUrl}/api/v2/ground-transport/${encodeURIComponent(orderId)}/stops/${stopId}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(stop),
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
    console.error('[updateStopAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to update stop' };
  }
}

// ---------------------------------------------------------------------------
// Update Leg
// ---------------------------------------------------------------------------

export async function updateLegAction(
  orderId: string,
  legId: number,
  payload: Partial<OrderLeg>,
): Promise<{ success: true; data: OrderLeg[] } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(
      `${auth.serverUrl}/api/v2/ground-transport/${encodeURIComponent(orderId)}/legs/${legId}`,
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

export async function fetchShipmentScopeAction(
  shipmentId: string,
): Promise<{ success: true; data: ScopeFlags } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(
      `${auth.serverUrl}/api/v2/shipments/${encodeURIComponent(shipmentId)}/scope`,
      { headers: { Authorization: `Bearer ${auth.token}` }, cache: 'no-store' },
    );

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[fetchShipmentScopeAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to fetch shipment scope' };
  }
}

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
      `${auth.serverUrl}/api/v2/shipments/${encodeURIComponent(shipmentId)}/scope`,
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
// Fetch Vehicle Types
// ---------------------------------------------------------------------------

export async function fetchVehicleTypesAction(): Promise<
  { success: true; data: VehicleType[] } | { success: false; error: string }
> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const res = await fetch(`${auth.serverUrl}/api/v2/ground-transport/vehicle-types`, {
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
    console.error('[fetchVehicleTypesAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to fetch vehicle types' };
  }
}

// ---------------------------------------------------------------------------
// Place Autocomplete
// ---------------------------------------------------------------------------

export async function fetchPlaceAutocompleteAction(
  input: string,
  sessiontoken?: string,
): Promise<{ success: true; data: { place_id: string; description: string }[] } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const url = new URL('/api/v2/ground-transport/geocode/autocomplete', auth.serverUrl);
    url.searchParams.set('input', input);
    if (sessiontoken) url.searchParams.set('sessiontoken', sessiontoken);

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
    console.error('[fetchPlaceAutocompleteAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to fetch autocomplete suggestions' };
  }
}

// ---------------------------------------------------------------------------
// Place Details
// ---------------------------------------------------------------------------

export async function fetchPlaceDetailsAction(
  place_id: string,
  sessiontoken?: string,
): Promise<{ success: true; data: GeocodeResult } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const url = new URL('/api/v2/ground-transport/geocode/place', auth.serverUrl);
    url.searchParams.set('place_id', place_id);
    if (sessiontoken) url.searchParams.set('sessiontoken', sessiontoken);

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
    console.error('[fetchPlaceDetailsAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to fetch place details' };
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

// ---------------------------------------------------------------------------
// Fetch Transport Order by Shipment Task
// ---------------------------------------------------------------------------

export async function fetchTransportOrderByTaskAction(
  shipmentId: string,
  taskRef: string,
): Promise<
  | { success: true; data: GroundTransportOrder }
  | { success: false; error: 'NOT_FOUND' | string }
> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const url = new URL('/api/v2/ground-transport/by-task', auth.serverUrl);
    url.searchParams.set('shipment_id', shipmentId);
    url.searchParams.set('task_ref', taskRef);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: 'no-store',
    });

    if (res.status === 404) {
      return { success: false, error: 'NOT_FOUND' };
    }

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[fetchTransportOrderByTaskAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to fetch transport order by task' };
  }
}

// ---------------------------------------------------------------------------
// Nearest Areas (geo-matching)
// ---------------------------------------------------------------------------

export async function fetchNearestAreasAction(
  lat: number,
  lng: number,
  limit: number = 3,
): Promise<{ success: true; data: NearestAreaResult[] } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const url = new URL('/api/v2/ground-transport/areas/nearest', auth.serverUrl);
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lng', lng.toString());
    url.searchParams.set('limit', limit.toString());

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
    console.error('[fetchNearestAreasAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to fetch nearest areas' };
  }
}
