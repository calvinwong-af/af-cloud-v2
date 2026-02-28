/**
 * AcceleFreight Platform — ShipmentOrders Data Layer
 *
 * Server-side only. Reads from Datastore Kind: "Quotation" (the spine).
 * For V1 records (data_version absent/1): runs V1 assembly logic.
 * For V2 records (data_version: 2): reads directly.
 *
 * CRITICAL RULES:
 * - Never modify V1 records (read-only view layer)
 * - Never expose actual_component, cost fields to client
 * - All reads apply ?? defaults (no field guaranteed to exist)
 * - soft deletes only (trash: true) — always filter trash=false
 */

import { getDatastore } from './datastore-query';
import {
  assembleV1ShipmentOrder,
  deriveOrderType,
  mapV1QuotationStatus,
  assembleLocation,
} from './v1-assembly';
import type {
  ShipmentOrder,
  OrderType,
  ShipmentOrderStatus,
} from './types';

// ---------------------------------------------------------------------------
// V2 direct read (data_version: 2)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readV2ShipmentOrder(raw: Record<string, any>): ShipmentOrder {
  return {
    quotation_id:             raw.quotation_id as string ?? '',
    countid:                  raw.countid as number ?? 0,
    data_version:             2,

    company_id:               raw.company_id as string ?? '',
    order_type:               raw.order_type as OrderType ?? 'SEA_FCL',
    transaction_type:         raw.transaction_type ?? 'IMPORT',
    incoterm_code:            raw.incoterm_code ?? null,
    status:                   raw.status as ShipmentOrderStatus ?? 1001,
    issued_invoice:           raw.issued_invoice as boolean ?? false,
    last_status_updated:      raw.last_status_updated as string | null ?? null,
    status_history:           raw.status_history ?? [],

    parent_id:                raw.parent_id ?? null,
    related_orders:           raw.related_orders ?? [],
    commercial_quotation_ids: raw.commercial_quotation_ids ?? [],

    origin:                   raw.origin ?? null,
    destination:              raw.destination ?? null,

    cargo:                    raw.cargo ?? null,
    type_details:             raw.type_details ?? null,
    booking:                  raw.booking ?? null,

    parties:                  raw.parties ?? null,
    customs_clearance:        raw.customs_clearance ?? [],

    bl_document:              raw.bl_document ?? null,
    exception:                raw.exception ?? null,

    tracking_id:              raw.tracking_id ?? null,
    files:                    raw.files ?? [],
    trash:                    raw.trash ?? false,
    cargo_ready_date:         raw.cargo_ready_date ?? null,
    creator:                  raw.creator ?? null,
    user:                     raw.user ?? '',
    created:                  raw.created ?? '',
    updated:                  raw.updated ?? '',
  };
}

// ---------------------------------------------------------------------------
// List queries
// ---------------------------------------------------------------------------

export interface GetShipmentOrdersOptions {
  companyId?: string;
  status?: ShipmentOrderStatus[];
  orderType?: OrderType[];
  excludeTrash?: boolean;
  excludeChildren?: boolean;   // Exclude child ground legs (parent_id != null)
  limit?: number;
  /** For pagination — Datastore cursor string */
  cursor?: string;
}

export interface ShipmentOrderListResult {
  orders: ShipmentOrder[];
  nextCursor: string | null;
}

/**
 * Fetches a page of ShipmentOrders (light — no V1 Kind assembly).
 * For list views, we only need core fields. Full assembly is done on detail load.
 */
export async function getShipmentOrders(
  options: GetShipmentOrdersOptions = {}
): Promise<ShipmentOrderListResult> {
  const {
    companyId,
    excludeTrash = true,
    excludeChildren = true,
    limit = 50,
    cursor,
  } = options;

  const datastore = getDatastore();
  let query = datastore.createQuery('Quotation');

  if (excludeTrash) {
    query = query.filter('trash', '=', false);
  }
  if (companyId) {
    query = query.filter('company_id', '=', companyId);
  }

  query = query.order('updated', { descending: true }).limit(limit + 1);

  if (cursor) {
    query = query.start(cursor);
  }

  const [entities, queryInfo] = await datastore.runQuery(query);

  // Determine if there's a next page
  let nextCursor: string | null = null;
  if (entities.length > limit) {
    entities.pop();
    nextCursor = queryInfo.endCursor ?? null;
  }

  // Light read — just enough for list views
  const orders: ShipmentOrder[] = [];
  for (const entity of entities) {
    const raw = entity as Record<string, unknown>;

    // Skip child orders if requested
    if (excludeChildren && raw.parent_id) continue;

    const dataVersion = (raw.data_version as number | null) ?? 1;

    if (dataVersion >= 2) {
      orders.push(readV2ShipmentOrder(raw as Record<string, never>));
    } else {
      // ── V1 SHIPMENT FILTER ──────────────────────────────────────────────
      // Only show V1 records that have progressed to a confirmed shipment.
      // A V1 Quotation becomes a shipment when has_shipment=true (a
      // ShipmentOrder Kind record was created at booking confirmation).
      // We also accept status>=4001 as a safety net for records where
      // has_shipment was not set but the record clearly progressed.
      //
      // TODO (server session): This filter belongs in the Datastore query,
      // not in application code. When rebuilding the server layer, add a
      // composite index on (trash, has_shipment, status) and filter at
      // query time. This will eliminate the need to fetch-then-filter and
      // will significantly reduce Datastore read costs on large datasets.
      // ────────────────────────────────────────────────────────────────────
      const hasShipment = raw.has_shipment as boolean ?? false;
      const rawV1Status = raw.status as number | null ?? 0;
      const isConfirmedShipment = hasShipment || rawV1Status >= 4001;
      if (!isConfirmedShipment) continue;

      // Light V1 read — no Kind assembly for list view
      // Derive order type from V1 fields (no Datastore fetches)
      const orderType = deriveOrderType(
        raw.quotation_type as string | null,
        raw.quotation_category as string | null
      );
      const status = mapV1QuotationStatus(
        raw.status as number | null,
        hasShipment,
        null
      );
      const originCode = raw.origin_port_un_code as string | null ?? null;
      const destCode = raw.destination_port_un_code as string | null ?? null;

      orders.push({
        quotation_id:             raw.quotation_id as string ?? '',
        countid:                  raw.countid as number ?? 0,
        data_version:             1,
        company_id:               raw.company_id as string ?? '',
        order_type:               orderType,
        transaction_type:         (raw.transaction_type as ShipmentOrder['transaction_type']) ?? 'IMPORT',
        incoterm_code:            raw.incoterm_code as string | null ?? null,
        status,
        issued_invoice:           Boolean(raw.issued_invoice ?? false),
        last_status_updated:      raw.last_status_updated as string | null ?? null,
        status_history:           raw.status_history as ShipmentOrder['status_history'] ?? [],
        parent_id:                null,
        related_orders:           [],
        commercial_quotation_ids: raw.commercial_quotation_ids as string[] ?? [],
        origin:                   assembleLocation(originCode),
        destination:              assembleLocation(destCode),
        cargo:                    null,   // Not assembled for list view
        type_details:             null,   // Not assembled for list view
        booking:                  null,
        parties:                  null,   // Not assembled for list view
        customs_clearance:        [],
        exception:                null,
        tracking_id:              null,
        files:                    raw.files as string[] ?? [],
        trash:                    raw.trash as boolean ?? false,
        cargo_ready_date:         raw.cargo_ready_date as string | null ?? null,
        creator:                  raw.creator as ShipmentOrder['creator'] ?? null,
        user:                     raw.user as string ?? '',
        created:                  raw.created as string ?? '',
        updated:                  raw.updated as string ?? '',
      });
    }
  }

  // Filter by status/orderType post-fetch (Datastore has limited filtering)
  let filtered = orders;
  if (options.status?.length) {
    filtered = filtered.filter((o) => options.status!.includes(o.status));
  }
  if (options.orderType?.length) {
    filtered = filtered.filter((o) => options.orderType!.includes(o.order_type));
  }

  // Batch fetch company short names for display
  const companyIds = Array.from(new Set(orders.map((o) => o.company_id).filter(Boolean)));
  if (companyIds.length > 0) {
    const keys = Array.from(new Set(companyIds)).map((id) => datastore.key(['Company', id]));
    const [companyEntities] = await datastore.get(keys);
    const nameMap = new Map<string, string>();
    for (const entity of companyEntities) {
      if (entity?.company_id) {
        nameMap.set(entity.company_id, entity.short_name ?? entity.name ?? entity.company_id);
      }
    }
    // Attach display name to each order
    for (const order of orders) {
      if (order.company_id && nameMap.has(order.company_id)) {
        order._company_name = nameMap.get(order.company_id);
      }
    }
  }

  return { orders: filtered, nextCursor };
}

// ---------------------------------------------------------------------------
// Detail load — full V1 assembly
// ---------------------------------------------------------------------------

/**
 * Fetches a single ShipmentOrder with full V1 assembly.
 * For V1 records this makes multiple parallel Datastore fetches.
 */
export async function getShipmentOrderDetail(
  quotationId: string
): Promise<ShipmentOrder | null> {
  if (!quotationId) return null;
  const datastore = getDatastore();

  // Fetch the core Quotation record
  const quotationKey = datastore.key(['Quotation', quotationId]);
  const [quotationEntity] = await datastore.get(quotationKey);
  if (!quotationEntity) return null;

  const raw = quotationEntity as Record<string, unknown>;
  const dataVersion = (raw.data_version as number | null) ?? 1;

  if (dataVersion >= 2) {
    const order = readV2ShipmentOrder(raw as Record<string, never>);
    // Resolve company name for display
    if (order.company_id) {
      try {
        const companyKey = datastore.key(['Company', order.company_id]);
        const [companyEntity] = await datastore.get(companyKey);
        if (companyEntity) {
          order._company_name = companyEntity.name ?? companyEntity.short_name ?? order.company_id;
        }
      } catch {
        // Non-critical — fall back to showing company_id
      }
    }
    return order;
  }

  // V1: parallel fetch of all related Kinds
  const orderType = deriveOrderType(
    raw.quotation_type as string | null,
    raw.quotation_category as string | null
  );

  // Determine which type-specific Kind to fetch
  const typeKindName =
    orderType === 'SEA_FCL' ? 'QuotationFCL'
    : orderType === 'SEA_LCL' ? 'QuotationLCL'
    : orderType === 'AIR' ? 'QuotationAir'
    : null;

  const freightKey = datastore.key(['QuotationFreight', quotationId]);
  const typeKey = typeKindName ? datastore.key([typeKindName, quotationId]) : null;
  const shipmentOrderKey = datastore.key(['ShipmentOrder', quotationId]);

  const fetchPromises: Promise<[unknown]>[] = [
    datastore.get(freightKey),
    typeKey ? datastore.get(typeKey) : Promise.resolve([null] as [null]),
    datastore.get(shipmentOrderKey),
  ];

  const [[freightEntity], [typeEntity], [oldShipmentEntity]] =
    await Promise.all(fetchPromises);

  const assembled = assembleV1ShipmentOrder({
    quotation: raw,
    quotationFreight: freightEntity as Record<string, unknown> | null,
    typeKind: typeEntity as Record<string, unknown> | null,
    oldShipmentOrder: oldShipmentEntity as Record<string, unknown> | null,
  });
  // Resolve company name for display
  if (assembled.company_id) {
    try {
      const companyKey = datastore.key(['Company', assembled.company_id]);
      const [companyEntity] = await datastore.get(companyKey);
      if (companyEntity) {
        assembled._company_name = companyEntity.name ?? companyEntity.short_name ?? assembled.company_id;
      }
    } catch {
      // Non-critical — fall back to showing company_id
    }
  }
  return assembled;
}

// ---------------------------------------------------------------------------
// Stats — now served by af-server (GET /api/v2/shipments/stats).
// The ShipmentOrderStats interface is kept for type compatibility.
// ---------------------------------------------------------------------------

export interface ShipmentOrderStats {
  total: number;
  active: number;
  completed: number;
  to_invoice: number;
  draft: number;
  cancelled: number;
}
