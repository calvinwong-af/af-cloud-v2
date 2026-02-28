/**
 * AcceleFreight Platform V2 — Shared Type Definitions
 *
 * Single source of truth for all entity shapes used throughout af-platform.
 * This file implements the AF V2 Data Model Spec v0.4.
 *
 * Rules:
 * - All optional fields default to null/[]/false on read (never assume a field exists)
 * - V1 records (data_version absent or 1) require the assembly layer in shipments.ts
 * - Cost/margin data is never included in client-facing types
 */

// ---------------------------------------------------------------------------
// Shared / Primitives
// ---------------------------------------------------------------------------

export type AccountType = 'AFC' | 'AFU';
export type TransactionType = 'IMPORT' | 'EXPORT' | 'DOMESTIC';
export type OrderType = 'SEA_FCL' | 'SEA_LCL' | 'AIR' | 'CROSS_BORDER' | 'GROUND';
export type Incoterm = 'EXW' | 'FCA' | 'FAS' | 'FOB' | 'CFR' | 'CIF' | 'CPT' | 'CIP' | 'DAP' | 'DPU' | 'DDP';

// ---------------------------------------------------------------------------
// Location — unified port/address model (Section 3.6 of V2 spec)
// ---------------------------------------------------------------------------

export interface Location {
  type: 'PORT' | 'ADDRESS' | 'CITY';
  port_un_code: string | null;   // PORT type — e.g. 'CNSHA', 'MYPKG'
  city_id: string | null;        // CITY type — references City Kind
  address: string | null;        // ADDRESS type — free text
  country_code: string | null;   // ISO-2 — 'MY', 'CN', 'TH'
  label: string;                 // Display name — 'Shanghai', 'Port Klang'
}

// ---------------------------------------------------------------------------
// Cargo (Section 3.8)
// ---------------------------------------------------------------------------

export interface DGClassification {
  class: string;                    // UN DG class e.g. '3'
  un_number: string | null;         // e.g. 'UN1203'
  proper_shipping_name: string | null;
  packing_group: 'I' | 'II' | 'III' | null;
}

export interface Cargo {
  description: string;
  hs_code: string | null;
  dg_classification: DGClassification | null;
}

// ---------------------------------------------------------------------------
// Type Details — mode-specific cargo details (Section 3.7)
// ---------------------------------------------------------------------------

export interface PackageDetail {
  packaging_type: 'CARTON' | 'PALLET' | 'CRATE' | 'DRUM' | 'BAG' | 'BUNDLE' | 'OTHER';
  quantity: number;
  gross_weight_kg: number | null;
  volume_cbm: number | null;
}

export interface ContainerDetail {
  container_size: string;       // '20GP' | '40GP' | '40HC' | '45HC' etc.
  container_type: string;       // 'DRY' | 'REEFER' | 'OPEN_TOP' | 'FLAT_RACK'
  quantity: number;
  container_numbers: string[];
  seal_numbers: string[];
}

export interface TypeDetailsFCL {
  type: 'SEA_FCL';
  containers: ContainerDetail[];
}

export interface TypeDetailsLCL {
  type: 'SEA_LCL';
  packages: PackageDetail[];
}

export interface TypeDetailsAir {
  type: 'AIR';
  packages: PackageDetail[];
  chargeable_weight: number | null;
}

export interface TypeDetailsGround {
  type: 'GROUND';
  transport_mode: 'FULL_TRUCK' | 'LOOSE';
  tonnage: string | null;
  packages: PackageDetail[] | null;
}

export interface TypeDetailsCrossBorder {
  type: 'CROSS_BORDER';
  transport_mode: 'FULL_TRUCK' | 'LOOSE';
  border_crossing: string | null;
  origin_country: string;
  destination_country: string;
  tonnage: string | null;
  packages: PackageDetail[] | null;
}

export type TypeDetails =
  | TypeDetailsFCL
  | TypeDetailsLCL
  | TypeDetailsAir
  | TypeDetailsGround
  | TypeDetailsCrossBorder;

// ---------------------------------------------------------------------------
// Parties (Section 3.9) — snapshot + reference approach
// ---------------------------------------------------------------------------

export interface Party {
  // Snapshot — legal record at time of booking
  name: string;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  // Back-references to AF records (optional)
  company_id: string | null;
  company_contact_id: string | null;
}

export interface Parties {
  shipper: Party | null;
  consignee: Party | null;
  notify_party: Party | null;
}

// ---------------------------------------------------------------------------
// Customs Clearance (Section 4)
// ---------------------------------------------------------------------------

export interface CustomsClearanceEvent {
  type: 'EXPORT' | 'IMPORT';
  port_un_code: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'EXCEPTION';
  declaration_number: string | null;
  duty_amount: number | null;
  tax_amount: number | null;
  duty_tax_currency: string | null;
  documents: string[];
  notes: string | null;
  completed_at: string | null;
  updated: string;
}

// ---------------------------------------------------------------------------
// ShipmentOrder — V2 unified shape (Section 3)
// This is what the platform UI works with — assembled from V1 Kinds on old records,
// read directly for V2 records (data_version: 2).
// ---------------------------------------------------------------------------

/** V2 status codes for ShipmentOrder (v2.18 — incoterm-aware) */
export type ShipmentOrderStatus =
  | 1001  // Draft
  | 1002  // Pending Review
  | 2001  // Confirmed
  | 3001  // Booking Pending
  | 3002  // Booking Confirmed
  | 4001  // Departed
  | 4002  // Arrived
  | 5001  // Completed
  | -1;   // Cancelled

export const SHIPMENT_STATUS_LABELS: Record<number, string> = {
  1001: 'Draft',
  1002: 'Pending Review',
  2001: 'Confirmed',
  3001: 'Booking Pending',
  3002: 'Booking Confirmed',
  4001: 'Departed',
  4002: 'Arrived',
  5001: 'Completed',
  [-1]: 'Cancelled',
};

export const SHIPMENT_STATUS_COLOR: Record<number, string> = {
  1001: 'gray',
  1002: 'yellow',
  2001: 'blue',
  3001: 'orange',
  3002: 'teal',
  4001: 'sky',
  4002: 'indigo',
  5001: 'green',
  [-1]: 'gray',
};

/** Exception flag on a shipment — separate from status */
export interface ShipmentException {
  flagged: boolean;
  raised_at: string | null;
  raised_by: string | null;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Status paths — incoterm-aware progression
// ---------------------------------------------------------------------------

/** Path A: AF owns freight booking (includes booking nodes) */
export const STATUS_PATH_A: ShipmentOrderStatus[] = [1001, 1002, 2001, 3001, 3002, 4001, 4002, 5001];

/** Path B: AF does NOT own freight booking (skips booking nodes) */
export const STATUS_PATH_B: ShipmentOrderStatus[] = [1001, 1002, 2001, 4001, 4002, 5001];

/** Incoterm + transaction_type combos that use Path A (AF owns booking) */
const _PATH_A_COMBOS = new Set([
  'EXW_IMPORT',
  'FCA_EXPORT', 'FCA_IMPORT',
  'FOB_EXPORT', 'FOB_IMPORT',
  'CFR_EXPORT', 'CIF_EXPORT', 'CNF_EXPORT',
  'CPT_EXPORT', 'CIP_EXPORT',
  'DAP_EXPORT', 'DPU_EXPORT', 'DDP_EXPORT',
]);

export function getStatusPath(incoterm: string | null, transactionType: string | null): 'A' | 'B' {
  if (!incoterm || !transactionType) return 'A'; // default to full path
  const key = `${incoterm.toUpperCase().trim()}_${transactionType.toUpperCase().trim()}`;
  return _PATH_A_COMBOS.has(key) ? 'A' : 'B';
}

export function getStatusPathList(incoterm: string | null, transactionType: string | null): ShipmentOrderStatus[] {
  return getStatusPath(incoterm, transactionType) === 'A' ? STATUS_PATH_A : STATUS_PATH_B;
}

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  SEA_FCL: 'Sea FCL',
  SEA_LCL: 'Sea LCL',
  AIR: 'Air Freight',
  CROSS_BORDER: 'Cross-Border',
  GROUND: 'Ground',
};

export interface StatusHistoryEntry {
  status: ShipmentOrderStatus;
  label: string;
  timestamp: string;         // ISO datetime
  changed_by: string;        // user email
  note: string | null;
}

export interface ShipmentOrder {
  // Identity
  quotation_id: string;           // AFCQ-XXXXXX
  countid: number;
  data_version: number;           // 1 = V1, 2 = V2. Default: 1

  // Core fields
  company_id: string;             // AFC-XXXXXX
  order_type: OrderType;          // V2 field. For V1: derived from quotation_type
  transaction_type: TransactionType;
  incoterm_code: string | null;
  status: ShipmentOrderStatus;
  issued_invoice: boolean;                    // V1: maps from issued_invoice. V2: direct field. Default: false
  last_status_updated: string | null;         // ISO datetime. Default: null
  status_history: StatusHistoryEntry[];       // Append-only log. Default: []

  // Relationships
  parent_id: string | null;       // AFCQ-XXXXXX if child ground leg
  related_orders: string[];       // Deferred — always [] for now
  commercial_quotation_ids: string[];  // AFQ-XXXXXX references

  // Locations (structured, V2 native)
  origin: Location | null;
  destination: Location | null;

  // Cargo & mode details
  cargo: Cargo | null;
  type_details: TypeDetails | null;
  booking: Record<string, unknown> | null;  // V1 compat only

  // Parties
  parties: Parties | null;

  // Customs
  customs_clearance: CustomsClearanceEvent[];

  // BL document — raw parsed values from BL upload (audit record)
  bl_document: {
    shipper?: { name: string | null; address: string | null } | null;
    consignee?: { name: string | null; address: string | null } | null;
  } | null;

  // Exception flag (v2.18)
  exception: ShipmentException | null;

  // Admin
  tracking_id: string | null;
  files: string[];
  trash: boolean;
  cargo_ready_date: string | null;
  creator: { uid: string; email: string } | null;
  user: string;
  created: string;
  updated: string;

  _company_name?: string;  // Display only — resolved at query time, not stored
}

// ---------------------------------------------------------------------------
// CommercialQuotation — new Kind (Section 5)
// ---------------------------------------------------------------------------

export type CommercialQuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REVISED' | 'EXPIRED';

export interface PricingLineItem {
  id: string;
  category: 'FREIGHT' | 'HAULAGE' | 'CUSTOMS' | 'LOCAL_CHARGES' | 'INSURANCE' | 'OTHER';
  description: string;
  unit: 'PER_CBM' | 'PER_KG' | 'PER_CONTAINER' | 'PER_SHIPMENT' | 'PER_BL' | 'LUMPSUM';
  quantity: number;
  unit_price: number;
  amount: number;
  tax_applicable: boolean;
  tax_amount: number | null;
  product_service_item_id: string | null;
  sort_order: number;
  // NOTE: cost_price, margin, margin_percentage, supplier_id NEVER included here — server-side only
}

export interface CommercialQuotation {
  commercial_quotation_id: string;   // AFQ-XXXXXX
  countid: number;
  shipment_order_id: string;          // AFCQ-XXXXXX back-reference
  company_id: string;
  version: number;
  status: CommercialQuotationStatus;
  is_active: boolean;
  currency: string;
  pricing: PricingLineItem[];
  total: number;
  invoices: string[];
  taxes_duties_invoices: string[];
  issued_invoice: boolean;
  issued_taxes_duties_invoice: boolean;
  quote_generated: boolean;
  quote_generated_at: string | null;
  notes: string | null;
  trash: boolean;
  user: string;
  created: string;
  updated: string;
}

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------

export interface CompanyAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

export interface Company {
  company_id: string;          // AFC-XXXXXX
  countid: number;
  name: string;
  short_name: string;
  registration_number: string;
  address: CompanyAddress;
  contact_info: {
    phone?: string;
    email?: string;
    website?: string;
  };
  contact_persons: Array<{
    name?: string;
    phone?: string;
    email?: string;
    role?: string;
  }>;
  preferred_currency: string;
  approved: boolean;
  allow_access: boolean;
  xero_id: string | null;
  xero_sync: boolean;
  xero_sync_required: boolean;
  tags: string[];
  files: string[];
  trash: boolean;
  user: string;
  created: string;
  updated: string;
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export type UserRole = 'AFC-ADMIN' | 'AFC-M' | 'AFU-ADMIN' | string;

export interface UserRecord {
  uid: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  account_type: AccountType;
  role: UserRole | null;
  company_id: string | null;
  valid_access: boolean;
  email_validated: boolean;
  last_login: string | null;
  created: string;
  updated: string;
  // Derived / UI helpers
  _broken_link: boolean;
}

// ---------------------------------------------------------------------------
// System Logs
// ---------------------------------------------------------------------------

export interface AFSystemLog {
  timestamp: string;
  uid: string;
  email: string;
  account_type: AccountType;
  action: string;
  entity_kind: string;
  entity_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  success: boolean;
  error: string | null;
  meta: Record<string, unknown>;
}
