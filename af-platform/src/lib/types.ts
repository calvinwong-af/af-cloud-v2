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

/** V2 status codes for ShipmentOrder */
export type ShipmentOrderStatus =
  | 1001  // Draft
  | 1002  // Draft — Pending Review
  | 2001  // Confirmed
  | 2002  // Booking Pending
  | 3001  // Booked
  | 3002  // In Transit
  | 3003  // Arrived
  | 4001  // Clearance In Progress
  | 4002  // Exception
  | 5001  // Completed
  | -1;   // Cancelled

export const SHIPMENT_STATUS_LABELS: Record<number, string> = {
  1001: 'Draft',
  1002: 'Pending Review',
  2001: 'Confirmed',
  2002: 'Booking Pending',
  3001: 'Booked',
  3002: 'In Transit',
  3003: 'Arrived',
  4001: 'Clearance In Progress',
  4002: 'Exception',
  5001: 'Completed',
  [-1]: 'Cancelled',
};

export const SHIPMENT_STATUS_COLOR: Record<number, string> = {
  1001: 'gray',
  1002: 'yellow',
  2001: 'blue',
  2002: 'orange',
  3001: 'teal',
  3002: 'sky',
  3003: 'indigo',
  4001: 'purple',
  4002: 'red',
  5001: 'green',
  [-1]: 'gray',
};

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  SEA_FCL: 'Sea FCL',
  SEA_LCL: 'Sea LCL',
  AIR: 'Air Freight',
  CROSS_BORDER: 'Cross-Border',
  GROUND: 'Ground',
};

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
