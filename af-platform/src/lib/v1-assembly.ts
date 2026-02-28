/**
 * AcceleFreight Platform — V1 Read Assembly Layer
 *
 * When data_version is absent or 1, shipments are stored across multiple
 * Datastore Kinds (Quotation + QuotationFreight + QuotationLCL/FCL/Air +
 * ShipmentOrder + ShipmentOrderLCL/FCL/Air).
 *
 * This module assembles those into a single unified ShipmentOrder shape
 * matching the V2 spec. It is a READ-ONLY view layer — it never modifies
 * the underlying Datastore records.
 *
 * Rule: all field reads use ?? defaults. Never assume a field exists.
 */

import type {
  ShipmentOrder,
  ShipmentOrderStatus,
  OrderType,
  Location,
  Cargo,
  TypeDetails,
  TypeDetailsFCL,
  TypeDetailsLCL,
  TypeDetailsAir,
  Parties,
  Party,
  CustomsClearanceEvent,
} from './types';

// ---------------------------------------------------------------------------
// V1 Status Mapping
// ---------------------------------------------------------------------------

/**
 * Maps V1 Quotation.status (int) → V2 ShipmentOrder.status
 * When both Quotation.status and old ShipmentOrder.status are available,
 * the ShipmentOrder status takes precedence for active/in-transit states.
 */
export function mapV1QuotationStatus(
  quotationStatus: number | null | undefined,
  hasShipmentOrder: boolean,
  shipmentOrderStatus: number | null | undefined
): ShipmentOrderStatus {
  // If there's an active ShipmentOrder (old Kind), use its status
  if (hasShipmentOrder && shipmentOrderStatus != null) {
    return mapV1ShipmentOrderStatus(shipmentOrderStatus);
  }

  switch (quotationStatus) {
    case 1001: return 1001;  // Draft
    case 1002: return 1002;  // Draft Pending Review
    case 2001: return 2001;  // Submitted → Confirmed
    case 2002: return 2001;  // Submitted Revised → Confirmed
    case 3001: return 2001;  // Confirmed (old naming)
    case 4001: return 4001;  // Active → Departed
    case 5001: return 5001;  // Completed
    case -1:   return -1;    // Cancelled
    default:   return 1001;  // Unknown → Draft (safe fallback)
  }
}

function mapV1ShipmentOrderStatus(status: number): ShipmentOrderStatus {
  switch (status) {
    // Native V1 status codes → new V2 codes (v2.18)
    case 100:   return 2001;  // Created → Confirmed
    case 110:   return 3002;  // Booking Confirmed → Booking Confirmed
    case 4110:  return 4001;  // In Transit → Departed
    case 10000: return 5001;  // Completed
    // New V2 codes (v2.18) that af-server may have written to V1 ShipmentOrder.status
    case 1001:  return 1001;
    case 1002:  return 1002;
    case 2001:  return 2001;
    case 3001:  return 3001;
    case 3002:  return 3002;
    case 4001:  return 4001;
    case 4002:  return 4002;
    case 5001:  return 5001;
    case -1:    return -1;
    // Legacy codes that might still be in Datastore from pre-migration
    case 2002:  return 3001;  // old Booking Pending → new Booking Pending
    case 3003:  return 4002;  // old Arrived → new Arrived
    default:    return 2001;  // Truly unknown → Confirmed (safe fallback)
  }
}

// ---------------------------------------------------------------------------
// V1 Order Type Derivation
// ---------------------------------------------------------------------------

export function deriveOrderType(
  quotationType: string | null | undefined,
  quotationCategory: string | null | undefined
): OrderType {
  const type = quotationType?.toUpperCase();
  const cat = quotationCategory?.toUpperCase();

  if (type === 'FCL' && cat === 'SEA') return 'SEA_FCL';
  if (type === 'LCL' && cat === 'SEA') return 'SEA_LCL';
  if (type === 'AIR' || cat === 'AIR') return 'AIR';
  // CROSS_BORDER and GROUND are V2-only — V1 records won't have them
  return 'SEA_FCL'; // Safe fallback for unknown
}

// ---------------------------------------------------------------------------
// Location Assembly
// ---------------------------------------------------------------------------

export function assembleLocation(
  portUnCode: string | null | undefined,
  terminalId?: string | null,
  portLabel?: string | null
): Location | null {
  if (!portUnCode) return null;
  return {
    type: 'PORT',
    port_un_code: portUnCode,
    terminal_id: terminalId ?? null,
    city_id: null,
    address: null,
    country_code: null,
    label: portLabel ?? portUnCode,
  };
}

// ---------------------------------------------------------------------------
// Cargo Assembly
// ---------------------------------------------------------------------------

/**
 * Assembles cargo from V1 QuotationFreight fields.
 * QuotationFreight is a separate Datastore Kind keyed by AFCQ-XXXXXX.
 */
export function assembleCargo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quotationFreight: Record<string, any> | null | undefined
): Cargo | null {
  if (!quotationFreight) return null;

  const commodity = quotationFreight.commodity as string | null ?? null;
  const hsCode = quotationFreight.hs_code as string | null ?? null;
  const rawCargoType = quotationFreight.cargo_type;
  const cargoType = typeof rawCargoType === 'string'
    ? rawCargoType
    : String(rawCargoType ?? '');

  return {
    description: commodity ?? 'General Cargo',
    hs_code: hsCode,
    dg_classification: cargoType.startsWith('DG')
      ? {
          class: quotationFreight.dg_class ?? cargoType,
          un_number: null,
          proper_shipping_name: null,
          packing_group: null,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Type Details Assembly
// ---------------------------------------------------------------------------

/**
 * Assembles TypeDetails from V1 type-specific Kind (QuotationFCL/LCL/Air).
 */
export function assembleTypeDetails(
  orderType: OrderType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  typeKindData: Record<string, any> | null | undefined
): TypeDetails | null {
  if (!typeKindData) return null;

  switch (orderType) {
    case 'SEA_FCL': {
      // V1 containers may be on containers[] array or on individual fields
      const containers = typeKindData.containers as Array<{
        container_size?: string;
        container_type?: string;
        quantity?: number;
        container_numbers?: string[];
        seal_numbers?: string[];
      }> | null ?? [];

      // Old records with individual fields (container_size, container_quantity, container_type)
      // These are deprecated fields — present on 27% of old records
      if (containers.length === 0) {
        const legacySize = typeKindData.container_size as string | null;
        const legacyQty = typeKindData.container_quantity as number | null;
        const legacyType = typeKindData.container_type as string | null;
        if (legacySize) {
          containers.push({
            container_size: legacySize,
            container_type: legacyType ?? 'DRY',
            quantity: legacyQty ?? 1,
            container_numbers: [],
            seal_numbers: [],
          });
        }
      }

      const detail: TypeDetailsFCL = {
        type: 'SEA_FCL',
        containers: containers.map(c => ({
          container_size: c.container_size ?? '20GP',
          container_type: c.container_type ?? 'DRY',
          quantity: c.quantity ?? 1,
          container_numbers: c.container_numbers ?? [],
          seal_numbers: c.seal_numbers ?? [],
        })),
      };
      return detail;
    }

    case 'SEA_LCL': {
      const cargoUnits = typeKindData.cargo_units as Array<{
        packaging_type?: string;
        quantity?: number;
        gross_weight?: number;
        volume_cbm?: number;
      }> | null ?? [];

      const detail: TypeDetailsLCL = {
        type: 'SEA_LCL',
        packages: cargoUnits.map(u => ({
          packaging_type: (typeof u.packaging_type === 'string' ? u.packaging_type.toUpperCase() : 'CARTON') as TypeDetailsLCL['packages'][0]['packaging_type'],
          quantity: u.quantity ?? 1,
          gross_weight_kg: u.gross_weight ?? null,
          volume_cbm: u.volume_cbm ?? null,
        })),
      };
      return detail;
    }

    case 'AIR': {
      const packages = typeKindData.cargo_units as Array<{
        packaging_type?: string;
        quantity?: number;
        gross_weight?: number;
        volume_cbm?: number;
      }> | null ?? [];

      const detail: TypeDetailsAir = {
        type: 'AIR',
        packages: packages.map(u => ({
          packaging_type: (typeof u.packaging_type === 'string' ? u.packaging_type.toUpperCase() : 'CARTON') as TypeDetailsAir['packages'][0]['packaging_type'],
          quantity: u.quantity ?? 1,
          gross_weight_kg: u.gross_weight ?? null,
          volume_cbm: u.volume_cbm ?? null,
        })),
        chargeable_weight: typeKindData.chargeable_weight as number | null ?? null,
      };
      return detail;
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Parties Assembly
// ---------------------------------------------------------------------------

/**
 * Assembles Parties from V1 data using priority-based resolution:
 * 1. quotation.parties — structured dict written by modern endpoints (BL upload, parties edit)
 * 2. oldShipmentOrder.shipper/.consignee/.notify_party — structured objects from legacy system
 * 3. oldShipmentOrder.shipper_name/.consignee_name — flat string fields on older V1 records
 * 4. quotation.shipper_name/.consignee_name — flat string fields on Quotation entity
 */
export function assembleParties(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oldShipmentOrder: Record<string, any> | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  companyMap?: Map<string, Record<string, any>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quotation?: Record<string, any> | null,
): Parties | null {

  // ── Source 1: quotation.parties (most reliable — written by modern endpoints) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qParties = quotation?.parties as Record<string, any> | null ?? null;
  if (qParties && (qParties.shipper || qParties.consignee || qParties.notify_party)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toParty = (p: Record<string, any> | null | undefined): Party | null => {
      if (!p) return null;
      return {
        name: p.name as string ?? '',
        address: p.address as string | null ?? null,
        contact_person: p.contact_person as string | null ?? null,
        phone: p.phone as string | null ?? null,
        email: p.email as string | null ?? null,
        company_id: p.company_id as string | null ?? null,
        company_contact_id: p.company_contact_id as string | null ?? null,
      };
    };
    return {
      shipper: toParty(qParties.shipper),
      consignee: toParty(qParties.consignee),
      notify_party: toParty(qParties.notify_party),
    };
  }

  // ── Source 2: oldShipmentOrder structured objects (legacy system) ──
  if (oldShipmentOrder) {
    const hasStructured =
      oldShipmentOrder.shipper || oldShipmentOrder.consignee || oldShipmentOrder.notify_party;

    if (hasStructured) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buildParty = (ref: Record<string, any> | null | undefined): Party | null => {
        if (!ref) return null;
        const companyId = ref.company_id as string | null ?? null;
        const companyRecord = companyId && companyMap ? companyMap.get(companyId) : null;
        return {
          name: companyRecord?.name ?? ref.name ?? ref.tag ?? 'Unknown',
          address: companyRecord?.address?.line1 ?? null,
          contact_person: ref.contact_person ?? null,
          phone: ref.phone ?? null,
          email: ref.email ?? null,
          company_id: companyId,
          company_contact_id: ref.company_contact_id ?? null,
        };
      };
      return {
        shipper: buildParty(oldShipmentOrder.shipper),
        consignee: buildParty(oldShipmentOrder.consignee),
        notify_party: buildParty(oldShipmentOrder.notify_party),
      };
    }

    // ── Source 3: flat string fields on oldShipmentOrder ──
    const soShipperName = oldShipmentOrder.shipper_name as string | null ?? null;
    const soConsigneeName = oldShipmentOrder.consignee_name as string | null ?? null;
    if (soShipperName || soConsigneeName) {
      return {
        shipper: soShipperName ? {
          name: soShipperName,
          address: oldShipmentOrder.shipper_address as string | null ?? null,
          contact_person: null, phone: null, email: null,
          company_id: null, company_contact_id: null,
        } : null,
        consignee: soConsigneeName ? {
          name: soConsigneeName,
          address: oldShipmentOrder.consignee_address as string | null ?? null,
          contact_person: null, phone: null, email: null,
          company_id: null, company_contact_id: null,
        } : null,
        notify_party: null,
      };
    }
  }

  // ── Source 4: flat string fields on quotation ──
  const qShipperName = quotation?.shipper_name as string | null ?? null;
  const qConsigneeName = quotation?.consignee_name as string | null ?? null;
  if (qShipperName || qConsigneeName) {
    return {
      shipper: qShipperName ? {
        name: qShipperName,
        address: quotation?.shipper_address as string | null ?? null,
        contact_person: null, phone: null, email: null,
        company_id: null, company_contact_id: null,
      } : null,
      consignee: qConsigneeName ? {
        name: qConsigneeName,
        address: quotation?.consignee_address as string | null ?? null,
        contact_person: null, phone: null, email: null,
        company_id: null, company_contact_id: null,
      } : null,
      notify_party: null,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Customs Clearance Assembly
// ---------------------------------------------------------------------------

/**
 * Assembles customs clearance events from V1 QuotationFreight flags.
 * Full PortShipmentTasks data is loaded separately when needed.
 */
export function assembleCustomsClearance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quotationFreight: Record<string, any> | null | undefined,
  originPortCode: string | null,
  destinationPortCode: string | null
): CustomsClearanceEvent[] {
  if (!quotationFreight) return [];

  const events: CustomsClearanceEvent[] = [];
  const now = new Date().toISOString();

  if (quotationFreight.include_customs_clearance_export && originPortCode) {
    events.push({
      type: 'EXPORT',
      port_un_code: originPortCode,
      status: 'PENDING',
      declaration_number: null,
      duty_amount: null,
      tax_amount: null,
      duty_tax_currency: null,
      documents: [],
      notes: null,
      completed_at: null,
      updated: now,
    });
  }

  if (quotationFreight.include_customs_clearance_import && destinationPortCode) {
    events.push({
      type: 'IMPORT',
      port_un_code: destinationPortCode,
      status: 'PENDING',
      declaration_number: null,
      duty_amount: null,
      tax_amount: null,
      duty_tax_currency: null,
      documents: [],
      notes: null,
      completed_at: null,
      updated: now,
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Full V1 → V2 Assembly
// ---------------------------------------------------------------------------

/**
 * Assembles a unified ShipmentOrder from all V1 Kinds.
 *
 * Input: raw records fetched from Datastore for a given AFCQ-XXXXXX
 * Output: ShipmentOrder in V2 shape
 *
 * The assembly is a read-only view — source records are never modified.
 */
export function assembleV1ShipmentOrder(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quotation: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quotationFreight?: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  typeKind?: Record<string, any> | null;     // QuotationLCL/FCL/Air
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oldShipmentOrder?: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  companyMap?: Map<string, Record<string, any>>;
  portLabelMap?: Map<string, string>;
}): ShipmentOrder {
  const { quotation, quotationFreight, typeKind, oldShipmentOrder, companyMap, portLabelMap } = params;

  const q = quotation;

  // Derive order type from V1 fields
  const orderType = deriveOrderType(
    q.quotation_type as string | null,
    q.quotation_category as string | null
  );

  // Determine status
  const hasShipmentOrder = !!(q.has_shipment || oldShipmentOrder);
  const status = mapV1QuotationStatus(
    q.status as number | null,
    hasShipmentOrder,
    oldShipmentOrder?.status as number | null
  );

  // Build locations
  const originCode = q.origin_port_un_code as string | null ?? null;
  const destCode = q.destination_port_un_code as string | null ?? null;
  const originTerminal = q.origin_terminal_id as string | null ?? null;
  const destTerminal = q.destination_terminal_id as string | null ?? null;

  // Try terminal-specific label first, then base code label
  const originLabel = (originTerminal ? portLabelMap?.get(originTerminal) : null)
    ?? portLabelMap?.get(originCode ?? '') ?? originCode ?? '';
  const destLabel = (destTerminal ? portLabelMap?.get(destTerminal) : null)
    ?? portLabelMap?.get(destCode ?? '') ?? destCode ?? '';

  const origin = assembleLocation(originCode, originTerminal, originLabel);
  const destination = assembleLocation(destCode, destTerminal, destLabel);

  // Cargo
  const cargo = assembleCargo(quotationFreight);

  // Type details
  const typeDetails = assembleTypeDetails(orderType, typeKind);

  // Parties
  const parties = assembleParties(oldShipmentOrder, companyMap, q);

  // Customs clearance (structural)
  const customsClearance = assembleCustomsClearance(
    quotationFreight,
    originCode,
    destCode
  );

  return {
    quotation_id: q.quotation_id as string,
    countid: q.countid as number ?? 0,
    data_version: 1,

    company_id: q.company_id as string ?? '',
    order_type: orderType,
    transaction_type: (q.transaction_type as string ?? 'IMPORT') as ShipmentOrder['transaction_type'],
    incoterm_code: q.incoterm_code as string | null ?? null,
    status,
    issued_invoice: q.issued_invoice as boolean ?? false,
    last_status_updated: q.last_status_updated as string | null ?? null,
    status_history: q.status_history as ShipmentOrder['status_history'] ?? [],

    parent_id: null,
    related_orders: [],
    commercial_quotation_ids: q.commercial_quotation_ids as string[] ?? [],

    origin,
    destination,

    cargo,
    type_details: typeDetails,
    // Prefer q.booking if so.booking exists but has no vessel data (null fields from legacy system)
    booking: (() => {
      const soBooking = oldShipmentOrder?.booking as Record<string, unknown> | null ?? null;
      const qBooking = q.booking as Record<string, unknown> | null ?? null;
      if (!soBooking) return qBooking;
      const soHasData = soBooking.vessel_name || soBooking.voyage_number || soBooking.bl_number || soBooking.booking_reference;
      return soHasData ? soBooking : (qBooking ?? soBooking);
    })() as Record<string, unknown> | null,

    parties,
    customs_clearance: customsClearance,

    bl_document: (q.bl_document as { shipper?: { name: string | null; address: string | null } | null; consignee?: { name: string | null; address: string | null } | null } | null) ?? null,
    exception: null,

    tracking_id: oldShipmentOrder?.tracking_id as string | null ?? null,
    files: q.files as string[] ?? [],
    trash: q.trash as boolean ?? false,
    cargo_ready_date: q.cargo_ready_date as string | null ?? null,
    creator: q.creator as ShipmentOrder['creator'] ?? null,
    user: q.user as string ?? '',
    created: q.created as string ?? '',
    updated: q.updated as string ?? '',
  };
}
