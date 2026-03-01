'use server';

import { verifySessionAndRole, logAction } from '@/lib/auth-server';
import {
  createShipmentOrder,
  deleteShipmentOrder,
  type CreateShipmentOrderInput,
  type CreateShipmentOrderResult,
  type UpdateInvoicedStatusResult,
  type DeleteShipmentOrderResult,
} from '@/lib/shipments-write';
import type { ShipmentOrderStatus } from '@/lib/types';

type UpdateShipmentStatusResult = { success: true } | { success: false; error: string };

export interface CreateShipmentOrderPayload {
  order_type: 'SEA_FCL' | 'SEA_LCL' | 'AIR';
  transaction_type: 'IMPORT' | 'EXPORT' | 'DOMESTIC';
  company_id: string;
  origin_port_un_code: string;
  origin_terminal_id: string | null;
  origin_label: string;
  destination_port_un_code: string;
  destination_terminal_id: string | null;
  destination_label: string;
  incoterm_code: string | null;
  cargo_description: string;
  cargo_hs_code: string | null;
  cargo_is_dg: boolean;
  containers: Array<{
    container_size: string;
    container_type: string;
    quantity: number;
  }>;
  packages: Array<{
    packaging_type: string;
    quantity: number;
    gross_weight_kg: number | null;
    volume_cbm: number | null;
  }>;
  shipper: {
    name: string;
    address: string | null;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    company_id: string | null;
    company_contact_id: string | null;
  } | null;
  consignee: {
    name: string;
    address: string | null;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    company_id: string | null;
    company_contact_id: string | null;
  } | null;
  notify_party: {
    name: string;
    address: string | null;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    company_id: string | null;
    company_contact_id: string | null;
  } | null;
  cargo_ready_date: string | null;
  etd: string | null;
  eta: string | null;
}

export async function createShipmentOrderAction(
  payload: CreateShipmentOrderPayload
): Promise<CreateShipmentOrderResult> {
  // 1. Auth — internal staff only
  const session = await verifySessionAndRole(['AFU-ADMIN']);
  if (!session.valid) {
    return { success: false, error: 'Unauthorised' };
  }

  // 2. Basic validation
  if (!payload.company_id) return { success: false, error: 'Company is required' };
  if (!payload.origin_port_un_code) return { success: false, error: 'Origin port is required' };
  if (!payload.destination_port_un_code) return { success: false, error: 'Destination port is required' };
  if (payload.order_type === 'SEA_FCL') {
    if (!payload.containers || payload.containers.length === 0) {
      return { success: false, error: 'At least one container is required' };
    }
    for (const c of payload.containers) {
      if (!c.container_size || !c.container_type || !c.quantity || c.quantity < 1) {
        return { success: false, error: 'All container fields are required and quantity must be ≥ 1' };
      }
    }
  } else {
    if (!payload.packages || payload.packages.length === 0) {
      return { success: false, error: 'At least one package is required' };
    }
    for (const p of payload.packages) {
      if (!p.quantity || p.quantity < 1) {
        return { success: false, error: 'Package quantity must be at least 1' };
      }
    }
  }

  // 3. Build input — map flat payload to nested lib input
  const input: CreateShipmentOrderInput = {
    order_type: payload.order_type,
    transaction_type: payload.transaction_type,
    company_id: payload.company_id,
    company_key_path: [{ kind: 'Company', name: payload.company_id }],
    origin_port_un_code: payload.origin_port_un_code,
    origin_terminal_id: payload.origin_terminal_id ?? null,
    origin_label: payload.origin_label,
    destination_port_un_code: payload.destination_port_un_code,
    destination_terminal_id: payload.destination_terminal_id ?? null,
    destination_label: payload.destination_label,
    incoterm_code: payload.incoterm_code ?? '',
    cargo: {
      description: payload.cargo_description.trim(),
      hs_code: payload.cargo_hs_code?.trim() || null,
      is_dg: payload.cargo_is_dg,
      dg_class: null,
      dg_un_number: null,
    },
    containers: payload.containers ?? [],
    packages: payload.packages ?? [],
    parties: {
      shipper: payload.shipper,
      consignee: payload.consignee,
      notify_party: payload.notify_party,
    },
    cargo_ready_date: payload.cargo_ready_date,
    etd: payload.etd,
    eta: payload.eta,
    creator_uid: session.uid,
    creator_email: session.email,
  };

  // 4. Write
  const result = await createShipmentOrder(input);

  // 5. Log at action level
  try {
    await logAction({
      uid: session.uid,
      email: session.email,
      account_type: session.account_type,
      action: 'CREATE_SHIPMENT_ORDER',
      entity_kind: 'Quotation',
      entity_id: result.success ? result.shipment_id : 'unknown',
      success: result.success,
      error: result.success ? null : result.error,
      meta: {
        order_type: payload.order_type,
        transaction_type: payload.transaction_type,
        company_id: payload.company_id,
        tracking_id: result.success ? result.tracking_id : null,
      },
    });
  } catch (logError) {
    // Never let logging failure break the operation
    console.error('[createShipmentOrderAction] Logging failed:', logError);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Update Shipment Status
// ---------------------------------------------------------------------------

export async function updateShipmentStatusAction(
  shipment_id: string,
  new_status: ShipmentOrderStatus,
  allow_jump?: boolean,
  reverted?: boolean,
): Promise<UpdateShipmentStatusResult> {
  const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF', 'AFC-ADMIN', 'AFC-M']);
  if (!session.valid) {
    return { success: false, error: 'Unauthorised' };
  }

  try {
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) {
      return { success: false, error: 'No session token' };
    }

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipment_id)}/status`,
      process.env.AF_SERVER_URL,
    );
    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: new_status,
        allow_jump: allow_jump ?? false,
        reverted: reverted ?? false,
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.detail ?? json?.msg ?? `Server responded ${res.status}`;
      return { success: false, error: msg };
    }

    const json = await res.json();
    if (json.status === 'ERROR') {
      return { success: false, error: json.msg ?? 'Status update failed' };
    }

    return { success: true };
  } catch (err) {
    console.error('[updateShipmentStatusAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to update shipment status' };
  }
}

// ---------------------------------------------------------------------------
// Update Invoiced Status
// ---------------------------------------------------------------------------

export async function updateInvoicedStatusAction(
  shipment_id: string,
  issued_invoice: boolean,
): Promise<UpdateInvoicedStatusResult> {
  const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
  if (!session.valid) {
    return { success: false, error: 'Unauthorised' };
  }

  try {
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) return { success: false, error: 'No session token' };

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipment_id)}/invoiced`,
      process.env.AF_SERVER_URL,
    );
    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ issued_invoice }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? json?.msg ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    if (json.status === 'ERROR') return { success: false, error: json.msg ?? 'Update failed' };
    return { success: true };
  } catch (err) {
    console.error('[updateInvoicedStatusAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to update invoiced status' };
  }
}

// ---------------------------------------------------------------------------
// Delete Shipment Order
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fetch Shipment Tasks (via af-server)
// ---------------------------------------------------------------------------

export interface WorkflowTask {
  task_id: string;
  task_type: string;
  display_name: string;
  leg_level: number;
  mode: string;
  status: string;
  assigned_to: string;
  third_party_name: string | null;
  visibility: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  due_date: string | null;
  due_date_override: boolean;
  notes: string | null;
  completed_at: string | null;
  updated_by: string;
  updated_at: string;
}

type FetchTasksResult =
  | { success: true; data: WorkflowTask[] }
  | { success: false; error: string };

export async function fetchShipmentTasksAction(
  shipmentId: string
): Promise<FetchTasksResult> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF', 'AFC-ADMIN', 'AFC-M']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) {
      return { success: false, error: 'No session token' };
    }

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) {
      return { success: false, error: 'Server URL not configured' };
    }

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipmentId)}/tasks`,
      serverUrl,
    );
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.detail ?? `Server responded ${res.status}`;
      return { success: false, error: msg };
    }

    const json = await res.json();
    return { success: true, data: json.tasks ?? [] };
  } catch (err) {
    console.error('[fetchShipmentTasksAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to load tasks' };
  }
}

// ---------------------------------------------------------------------------
// Update Shipment Task (via af-server)
// ---------------------------------------------------------------------------

type UpdateTaskResult =
  | { success: true; data: WorkflowTask; warning?: string }
  | { success: false; error: string };

export async function updateShipmentTaskAction(
  shipmentId: string,
  taskId: string,
  updates: Record<string, unknown>,
): Promise<UpdateTaskResult> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF', 'AFC-ADMIN', 'AFC-M']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) {
      return { success: false, error: 'No session token' };
    }

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) {
      return { success: false, error: 'Server URL not configured' };
    }

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipmentId)}/tasks/${encodeURIComponent(taskId)}`,
      serverUrl,
    );
    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.detail ?? `Server responded ${res.status}`;
      return { success: false, error: msg };
    }

    const json = await res.json();
    const result: UpdateTaskResult = { success: true, data: json.data ?? {} as WorkflowTask };
    if (json.warning) {
      result.warning = json.warning;
    }
    return result;
  } catch (err) {
    console.error('[updateShipmentTaskAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to update task' };
  }
}

// ---------------------------------------------------------------------------
// Flag / Clear Exception
// ---------------------------------------------------------------------------

type FlagExceptionResult =
  | { success: true; data: { exception: { flagged: boolean; raised_at: string | null; raised_by: string | null; notes: string | null } } }
  | { success: false; error: string };

export async function flagExceptionAction(
  shipmentId: string,
  flagged: boolean,
  notes: string | null,
): Promise<FlagExceptionResult> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF', 'AFC-ADMIN', 'AFC-M']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) {
      return { success: false, error: 'No session token' };
    }

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) {
      return { success: false, error: 'Server URL not configured' };
    }

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipmentId)}/exception`,
      serverUrl,
    );
    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ flagged, notes }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.detail ?? `Server responded ${res.status}`;
      return { success: false, error: msg };
    }

    const json = await res.json();
    return { success: true, data: json.data ?? {} };
  } catch (err) {
    console.error('[flagExceptionAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to update exception flag' };
  }
}

// ---------------------------------------------------------------------------
// Delete Shipment Order
// ---------------------------------------------------------------------------

export async function deleteShipmentOrderAction(
  shipment_id: string
): Promise<DeleteShipmentOrderResult> {
  const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF', 'AFC-ADMIN', 'AFC-M']);
  if (!session.valid) {
    return { success: false, error: 'Unauthorised' };
  }

  return deleteShipmentOrder({
    shipment_id,
    changed_by_uid: session.uid,
    changed_by_email: session.email,
  });
}

// ---------------------------------------------------------------------------
// Parse BL (Upload BL → Claude API)
// ---------------------------------------------------------------------------

type ParseBLResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: string };

export async function parseBLAction(
  formData: FormData,
): Promise<ParseBLResult> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) {
      return { success: false, error: 'No session token' };
    }

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) {
      return { success: false, error: 'Server URL not configured' };
    }

    const url = new URL('/api/v2/shipments/parse-bl', serverUrl);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.detail ?? `Server responded ${res.status}`;
      return { success: false, error: msg };
    }

    const json = await res.json();
    return { success: true, data: json };
  } catch (err) {
    console.error('[parseBLAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to parse BL' };
  }
}

// ---------------------------------------------------------------------------
// Create Shipment from BL
// ---------------------------------------------------------------------------

export interface CreateFromBLPayload {
  order_type: string;
  transaction_type: string;
  incoterm_code: string;
  company_id: string | null;
  origin_port_un_code: string | null;
  origin_terminal_id: string | null;
  origin_label: string | null;
  destination_port_un_code: string | null;
  destination_terminal_id: string | null;
  destination_label: string | null;
  cargo_description: string | null;
  cargo_weight_kg: number | null;
  etd: string | null;
  initial_status: number;
  carrier: string | null;
  waybill_number: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  shipper_name: string | null;
  shipper_address: string | null;
  consignee_name: string | null;
  consignee_address: string | null;
  notify_party_name: string | null;
  containers: Array<{
    container_number: string | null;
    container_type: string | null;
    seal_number: string | null;
    packages: string | null;
    weight_kg: number | null;
  }> | null;
  customer_reference: string | null;
}

type CreateFromBLResult =
  | { success: true; shipment_id: string }
  | { success: false; error: string };

export async function createShipmentFromBLAction(
  payload: CreateFromBLPayload,
): Promise<CreateFromBLResult> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) {
      return { success: false, error: 'No session token' };
    }

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) {
      return { success: false, error: 'Server URL not configured' };
    }

    const url = new URL('/api/v2/shipments/create-from-bl', serverUrl);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.detail ?? `Server responded ${res.status}`;
      return { success: false, error: msg };
    }

    const json = await res.json();
    return { success: true, shipment_id: json.data?.shipment_id ?? '' };
  } catch (err) {
    console.error('[createShipmentFromBLAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to create shipment from BL' };
  }
}

// ---------------------------------------------------------------------------
// Update Shipment from BL (PATCH /api/v2/shipments/{id}/bl)
// ---------------------------------------------------------------------------

export interface UpdateFromBLPayload {
  waybill_number?: string;
  carrier_agent?: string;
  vessel_name?: string;
  voyage_number?: string;
  etd?: string;
  shipper_name?: string;
  shipper_address?: string;
  containers?: Array<{
    container_number: string;
    container_type: string;
    seal_number?: string;
  }>;
  cargo_items?: Array<{
    description?: string;
    quantity?: string;
    gross_weight?: string;
    measurement?: string;
  }>;
  file?: File;
}

export interface UpdateFromBLResult {
  shipment_id: string;
  booking: Record<string, unknown>;
  parties: Record<string, unknown>;
  etd: string | null;
}

type UpdateFromBLActionResult =
  | { success: true; data: UpdateFromBLResult }
  | { success: false; error: string };

export async function updateShipmentFromBLAction(
  shipmentId: string,
  formData: FormData,
): Promise<UpdateFromBLActionResult> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) return { success: false, error: 'No session token' };

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) return { success: false, error: 'Server URL not configured' };

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipmentId)}/bl`,
      serverUrl,
    );

    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
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
    console.error('[updateShipmentFromBLAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to update shipment from BL' };
  }
}

// ---------------------------------------------------------------------------
// Update Parties (shipper + consignee)
// ---------------------------------------------------------------------------

export async function updatePartiesAction(
  shipmentId: string,
  parties: {
    shipper_name: string | null;
    shipper_address: string | null;
    consignee_name: string | null;
    consignee_address: string | null;
    notify_party_name: string | null;
    notify_party_address: string | null;
  }
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) return { success: false, error: 'No session token' };

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) return { success: false, error: 'Server URL not configured' };

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipmentId)}/parties`,
      serverUrl,
    );

    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parties),
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.detail ?? `Server responded ${res.status}`;
      return { success: false, error: msg };
    }

    return { success: true };
  } catch (err) {
    console.error('[updatePartiesAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to update parties' };
  }
}
