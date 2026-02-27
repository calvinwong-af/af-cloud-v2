'use server';

import { verifySessionAndRole } from '@/lib/auth-server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteNode {
  port_un_code: string;
  port_name: string;
  sequence: number;
  role: 'ORIGIN' | 'TRANSHIP' | 'DESTINATION';
  scheduled_eta: string | null;
  actual_eta: string | null;
  scheduled_etd: string | null;
  actual_etd: string | null;
  country?: string;
  port_type?: string;
}

type GetRouteNodesResult =
  | { success: true; data: RouteNode[]; derived: boolean }
  | { success: false; error: string };

type SaveRouteNodesResult =
  | { success: true; data: RouteNode[] }
  | { success: false; error: string };

type UpdateNodeTimingResult =
  | { success: true; data: RouteNode }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthHeaders(): Promise<{ idToken: string; serverUrl: string } | null> {
  const { cookies } = await import('next/headers');
  const cookieStore = cookies();
  const idToken = cookieStore.get('af-session')?.value;
  if (!idToken) return null;
  const serverUrl = process.env.AF_SERVER_URL;
  if (!serverUrl) return null;
  return { idToken, serverUrl };
}

// ---------------------------------------------------------------------------
// GET route nodes
// ---------------------------------------------------------------------------

export async function getRouteNodesAction(
  shipmentId: string
): Promise<GetRouteNodesResult> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF', 'AFC-ADMIN', 'AFC-M', 'AFC']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token' };

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipmentId)}/route-nodes`,
      auth.serverUrl,
    );
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${auth.idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.route_nodes ?? [], derived: json.derived ?? true };
  } catch (err) {
    console.error('[getRouteNodesAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to load route nodes' };
  }
}

// ---------------------------------------------------------------------------
// PUT route nodes (full replace)
// ---------------------------------------------------------------------------

export async function saveRouteNodesAction(
  shipmentId: string,
  nodes: RouteNode[],
): Promise<SaveRouteNodesResult> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF', 'AFC-ADMIN', 'AFC-M']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token' };

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipmentId)}/route-nodes`,
      auth.serverUrl,
    );
    const res = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${auth.idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nodes),
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.route_nodes ?? [] };
  } catch (err) {
    console.error('[saveRouteNodesAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to save route nodes' };
  }
}

// ---------------------------------------------------------------------------
// PATCH single node timing
// ---------------------------------------------------------------------------

export async function updateRouteNodeTimingAction(
  shipmentId: string,
  sequence: number,
  timing: Partial<Pick<RouteNode, 'scheduled_eta' | 'actual_eta' | 'scheduled_etd' | 'actual_etd'>>,
): Promise<UpdateNodeTimingResult> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF', 'AFC-ADMIN', 'AFC-M']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token' };

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipmentId)}/route-nodes/${sequence}`,
      auth.serverUrl,
    );
    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${auth.idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(timing),
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.node ?? {} as RouteNode };
  } catch (err) {
    console.error('[updateRouteNodeTimingAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to update route node' };
  }
}
