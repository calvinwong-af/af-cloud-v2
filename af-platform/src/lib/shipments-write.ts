/**
 * AcceleFreight Platform — Shipment Order Write Operations (V2)
 *
 * Server-side only. Creates V2 ShipmentOrders in the Quotation Kind.
 * V2 records use the `AF2-` prefix with a separate counter (ShipmentOrderV2Counter).
 * The V1 `AFCQ-XXXXXX` counter is never touched.
 *
 * Three Core Pillars: process logging, error handling, security (caller enforces auth).
 */

import { getDatastore } from './datastore-query';
import { Transaction } from '@google-cloud/datastore';
import { logAction } from './auth-server';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type CreateShipmentOrderResult =
  | { success: true; shipment_id: string; tracking_id: string }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface PartyInput {
  name: string;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  company_id: string | null;
  company_contact_id: string | null;
}

export interface CreateShipmentOrderInput {
  // Classification
  order_type: 'SEA_FCL' | 'SEA_LCL' | 'AIR';
  transaction_type: 'IMPORT' | 'EXPORT' | 'DOMESTIC';

  // Customer
  company_id: string;
  company_key_path: { kind: string; name: string }[];

  // Route
  origin_port_un_code: string;
  origin_label: string;
  destination_port_un_code: string;
  destination_label: string;
  incoterm_code: string;

  // Cargo
  cargo: {
    description: string;
    hs_code: string | null;
    is_dg: boolean;
    dg_class: string | null;
    dg_un_number: string | null;
  };

  // FCL containers
  containers: Array<{
    container_size: string;
    container_type: string;
    quantity: number;
  }>;

  // Parties
  parties: {
    shipper: PartyInput | null;
    consignee: PartyInput | null;
    notify_party: PartyInput | null;
  };

  // Dates
  cargo_ready_date: string | null;
  etd: string | null;
  eta: string | null;

  // Creator (from verified session)
  creator_uid: string;
  creator_email: string;
}

// ---------------------------------------------------------------------------
// Tracking ID generation
// ---------------------------------------------------------------------------

const TRACKING_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/l

function generateTrackingId(): string {
  const suffix = Array.from({ length: 7 }, () =>
    TRACKING_CHARS[Math.floor(Math.random() * TRACKING_CHARS.length)]
  ).join('');
  return `AF2${suffix}`;
}

// ---------------------------------------------------------------------------
// V1 compat helpers
// ---------------------------------------------------------------------------

function deriveV1Category(orderType: string): string {
  if (orderType === 'AIR') return 'AIR';
  return 'SEA';
}

function deriveV1QuotationType(orderType: string): string {
  if (orderType === 'SEA_LCL') return 'LCL';
  if (orderType === 'AIR') return 'AIR';
  return 'FCL';
}

function deriveContainerLoad(orderType: string): 'FCL' | 'LCL' | 'AIR' | '' {
  if (orderType === 'SEA_FCL') return 'FCL';
  if (orderType === 'SEA_LCL') return 'LCL';
  if (orderType === 'AIR') return 'AIR';
  return '';
}

// ---------------------------------------------------------------------------
// Next shipment ID — transactional counter on ShipmentOrderV2Counter
// ---------------------------------------------------------------------------

async function nextShipmentId(): Promise<{ shipment_id: string; countid: number }> {
  const ds = getDatastore();
  const counterKey = ds.key(['ShipmentOrderV2Counter', 'counter']);

  const [countid] = await ds.runInTransaction(async (transaction: Transaction) => {
    const [entity] = await transaction.get(counterKey);

    let newCount: number;
    if (!entity) {
      // First ever V2 shipment — bootstrap the counter
      newCount = 1;
      transaction.save({
        key: counterKey,
        data: { countid: newCount },
      });
    } else {
      newCount = (entity.countid as number) + 1;
      transaction.save({
        key: counterKey,
        data: { countid: newCount },
      });
    }

    return [newCount];
  });

  const shipment_id = 'AF2-' + String(countid).padStart(6, '0');
  return { shipment_id, countid };
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateInput(input: CreateShipmentOrderInput): string | null {
  if (!input.order_type) return 'order_type is required';
  if (!input.transaction_type) return 'transaction_type is required';
  if (!input.company_id?.trim()) return 'company_id is required';
  if (!input.company_key_path?.length) return 'company_key_path is required';
  if (!input.origin_port_un_code?.trim()) return 'origin_port_un_code is required';
  if (!input.destination_port_un_code?.trim()) return 'destination_port_un_code is required';
  if (!input.incoterm_code?.trim()) return 'incoterm_code is required';
  if (!input.cargo?.description?.trim()) return 'cargo description is required';
  if (!input.creator_uid?.trim()) return 'creator_uid is required';
  if (!input.creator_email?.trim()) return 'creator_email is required';
  return null;
}

// ---------------------------------------------------------------------------
// Create Shipment Order
// ---------------------------------------------------------------------------

export async function createShipmentOrder(
  input: CreateShipmentOrderInput
): Promise<CreateShipmentOrderResult> {
  // Validate input
  const validationError = validateInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  try {
    const ds = getDatastore();
    const now = new Date().toISOString();

    // 1. Generate shipment ID (transactional counter)
    const { shipment_id, countid } = await nextShipmentId();

    // 2. Generate tracking ID
    const trackingId = generateTrackingId();

    // 3. Build Quotation entity
    const quotation = {
      // Identity
      quotation_id: shipment_id,
      countid,
      data_version: 2,

      // Classification (V2)
      order_type: input.order_type,

      // V1 compat classification
      quotation_type: deriveV1QuotationType(input.order_type),
      quotation_category: deriveV1Category(input.order_type),

      // Route
      origin: {
        type: 'PORT',
        port_un_code: input.origin_port_un_code,
        city_id: null,
        address: null,
        country_code: null,
        label: input.origin_label,
      },
      destination: {
        type: 'PORT',
        port_un_code: input.destination_port_un_code,
        city_id: null,
        address: null,
        country_code: null,
        label: input.destination_label,
      },
      origin_port_un_code: input.origin_port_un_code,
      destination_port_un_code: input.destination_port_un_code,
      incoterm_code: input.incoterm_code,
      transaction_type: input.transaction_type,

      // Customer
      company_id: input.company_id,
      company_key: { path: input.company_key_path },

      // Cargo
      cargo: {
        description: input.cargo.description,
        hs_code: input.cargo.hs_code ?? null,
        dg_classification: input.cargo.is_dg
          ? {
              class: input.cargo.dg_class ?? '',
              un_number: input.cargo.dg_un_number ?? null,
              proper_shipping_name: null,
              packing_group: null,
            }
          : null,
      },

      // Type details
      type_details: {
        type: input.order_type,
        containers: input.containers.map((c) => ({
          container_size: c.container_size,
          container_type: c.container_type,
          quantity: c.quantity,
          container_numbers: [],
          seal_numbers: [],
        })),
      },

      // Parties
      parties: {
        shipper: input.parties.shipper,
        consignee: input.parties.consignee,
        notify_party: input.parties.notify_party,
      },

      // Status
      status: 1001,

      // Dates
      cargo_ready_date: input.cargo_ready_date ?? null,
      etd: input.etd ?? null,
      eta: input.eta ?? null,

      // Tracking
      tracking_id: trackingId,

      // V2 defaults
      parent_id: null,
      related_orders: [],
      customs_clearance: [],
      commercial_quotation_ids: [],
      booking: null,

      // Audit
      creator: { uid: input.creator_uid, email: input.creator_email },
      user: input.creator_email,
      files: [],
      trash: false,
      created: now,
      updated: now,
    };

    // 4. Save Quotation entity
    const quotationKey = ds.key(['Quotation', shipment_id]);
    await ds.save({
      key: quotationKey,
      data: quotation,
      excludeFromIndexes: [
        'origin', 'destination', 'cargo', 'type_details',
        'parties', 'files', 'related_orders', 'customs_clearance',
        'commercial_quotation_ids', 'booking', 'company_key',
      ],
    });

    // 5. Save ShipmentTrackingId entity
    const trackingKey = ds.key(['ShipmentTrackingId', trackingId]);
    await ds.save({
      key: trackingKey,
      data: {
        tracking_id: trackingId,
        shipment_id,
      },
    });

    // 6. Save ShipmentWorkFlow entity
    const workflowKey = ds.key(['ShipmentWorkFlow', shipment_id]);
    await ds.save({
      key: workflowKey,
      data: {
        workflow_id: shipment_id,
        shipment_id,
        company_id: input.company_id,
        transaction_type: input.transaction_type,
        container_load: deriveContainerLoad(input.order_type),
        incoterm: input.incoterm_code,
        workflow: {},
        workflow_meta_data: {
          start: { datetime: null, status: null },
          end: { datetime: null, status: null },
        },
        completed: false,
        trash: false,
        user: input.creator_email,
        created: now,
        updated: now,
      },
      excludeFromIndexes: ['workflow', 'workflow_meta_data'],
    });

    // 7. Log success
    await logAction({
      uid: input.creator_uid,
      email: input.creator_email,
      account_type: 'AFC',
      action: 'CREATE_SHIPMENT_ORDER',
      entity_kind: 'Quotation',
      entity_id: shipment_id,
      success: true,
      meta: { data_version: 2 },
    });

    return { success: true, shipment_id, tracking_id: trackingId };
  } catch (err) {
    console.error('[createShipmentOrder] Failed:', err);

    // Log failure (best-effort — logAction never throws)
    await logAction({
      uid: input.creator_uid,
      email: input.creator_email,
      account_type: 'AFC',
      action: 'CREATE_SHIPMENT_ORDER',
      entity_kind: 'Quotation',
      entity_id: '',
      success: false,
      error: err instanceof Error ? err.message : String(err),
      meta: { data_version: 2 },
    });

    return { success: false, error: 'Failed to create shipment order. Please try again.' };
  }
}
