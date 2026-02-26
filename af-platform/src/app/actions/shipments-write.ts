'use server';

import { verifySessionAndRole, logAction } from '@/lib/auth-server';
import {
  createShipmentOrder,
  type CreateShipmentOrderInput,
  type CreateShipmentOrderResult,
} from '@/lib/shipments-write';

export interface CreateShipmentOrderPayload {
  order_type: 'SEA_FCL' | 'SEA_LCL' | 'AIR';
  transaction_type: 'IMPORT' | 'EXPORT' | 'DOMESTIC';
  company_id: string;
  origin_port_un_code: string;
  origin_label: string;
  destination_port_un_code: string;
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
    origin_label: payload.origin_label,
    destination_port_un_code: payload.destination_port_un_code,
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
