# AcceleFreight — Firebase Datastore Structure Map
**Project:** cloud-accele-freight  
**Explored:** 24 February 2026  
**Total Kinds:** 61 · **Total Records:** 70,876  
**Purpose:** Migration reference — strangler fig rebuild from Vue → Next.js

---

## 1. The Spine — The AFCQ Index

The single most important thing in this entire system is the `AFCQ-XXXXXX` index. It is the shared key used across **11 Kinds** and is referenced by invoices, files, workflow, tracking, and comments. This index must never be changed, regenerated, or broken during migration.

```
AFCQ-000001  →  Quotation
             →  QuotationFreight
             →  QuotationLCL / QuotationFCL / QuotationAir  (one of three)
             →  ShipmentOrder
             →  ShipmentOrderLCL / ShipmentOrderFCL / ShipmentOrderAir  (one of three)
             →  ShipmentWorkFlow
             →  MasterInvoice
             →  Invoice.quotation_id  (multiple invoices per AFCQ)
             →  Files.shipment_order_id
             →  Comments.quotation_id
             →  PortShipmentTasks.shipment_order_id
```

**The index is the Datastore entity key itself** — not a field inside the entity. Reads and writes reference it as `['Quotation', 'AFCQ-000001']`. The `countid` field on `Quotation` and `Invoice` stores the sequential integer that generates the ID. Current ceiling: ~3,848 quotations (`AFCQ-003848`).

**Secondary indexes:**
- `AFC-XXXXXX` — Company key (641 companies, used as Datastore key for Company, CompanyRates, UserDashboard)
- `INV-XXXXXX` — Invoice key (658 invoices)
- `ShipmentTrackingId` uses its own random alphanumeric key (e.g. `AFIQAT5Q16`)

---

## 2. Core Operational Kinds

### 2.1 Quotation _(3,848 records)_
The root entity. Every operational record traces back here.

| Field | Type | Notes |
|---|---|---|
| `quotation_id` | string | `AFCQ-XXXXXX` — mirrors the entity key |
| `countid` | int | Sequential counter — source of the AFCQ number |
| `quotation_type` | string | `LCL` · `FCL` · `AIR` |
| `quotation_category` | string | `SEA` · `AIR` |
| `transaction_type` | string | `IMPORT` · `EXPORT` |
| `status` | int | See status codes below |
| `company_id` | string | `AFC-XXXXXX` |
| `company_key` | dict (Key ref) | `['Company', 'AFC-XXXXXX']` |
| `incoterm_code` | string | `FOB` · `CNF` · `EXW` · `CIF` · `DAP` etc. |
| `origin_port_un_code` | string | UN/LOCODE e.g. `VNSGN` |
| `destination_port_un_code` | string | UN/LOCODE e.g. `MYPKG` |
| `currency` | string | `MYR` · `USD` etc. |
| `draft` | bool | True = not yet submitted |
| `confirmed` | bool | Quotation accepted by customer |
| `has_shipment` | bool | Whether a ShipmentOrder exists for this |
| `issued_invoice` | bool | At least one invoice raised |
| `issued_taxes_duties_invoice` | bool | T&D invoice raised separately |
| `invoices` | list | `['INV-XXXXXX', ...]` |
| `taxes_duties_invoices` | list | `['INV-XXXXXX', ...]` |
| `files` | list | File references |
| `include_other_services` | bool | |
| `other_services` | NoneType / dict | |
| `admin_override` | bool | |
| `to_be_confirmed` | bool | |
| `trash` | bool | Soft delete flag |
| `creator` | dict | `{uid, email}` |
| `user` | string | Email of owner |
| `cargo_ready_date` | string (ISO datetime) | |
| `created` | string (ISO datetime) | |
| `updated` | string (ISO datetime) | |

**Quotation status codes:**
| Code | Meaning |
|---|---|
| `1001` | Draft |
| `2001` | Submitted / Pending |
| `3001` | Confirmed |
| `4001` | Active / In Progress |
| `5001` | Completed |

---

### 2.2 QuotationFreight _(3,848 records)_
One per Quotation. Holds the freight-specific parameters. Keyed by the same `AFCQ-XXXXXX`.

| Field | Type | Notes |
|---|---|---|
| `quotation_id` | string | AFCQ ref |
| `quotation_key` | dict (Key ref) | Points back to Quotation |
| `company_id` | string | |
| `company_key` | dict (Key ref) | |
| `freight_type` | string | `LCL` · `FCL` · `AIR` |
| `container_load` | string | `LCL` · `FCL` |
| `transaction_type` | string | `IMPORT` · `EXPORT` |
| `origin_port` | dict | Port object |
| `destination_port` | dict | Port object |
| `incoterm` | dict | Incoterm object |
| `cargo_type` | dict | CargoType reference |
| `cargo_value` | int | |
| `cargo_value_currency` | string | |
| `cargo_ready_date` | string | |
| `is_domestic` | bool | |
| `has_complete_price` | bool | |
| `has_freight_rate` | bool | |
| `override_has_complete_price` | bool | |
| `include_customs_clearance_import` | bool | |
| `include_customs_clearance_export` | bool | |
| `include_insurance` | bool | |
| `include_telex_release` | bool | |
| `include_letter_of_credit_handling` | bool | |
| `air_schedule` | dict | For AIR type — deprecated |
| `shipment_schedule` | dict | For SEA type |
| `hs_code` | NoneType / string | |
| `commodity` | NoneType / string | |

---

### 2.3 QuotationLCL _(1,674 records)_
Detail for LCL sea freight quotations. Keyed by `AFCQ-XXXXXX`.

| Field | Type | Notes |
|---|---|---|
| `quotation_id` | string | |
| `quotation_freight_key` | dict (Key ref) | |
| `cargo_units` | list | Cargo dimensions/weight objects |
| `estimate_component` | list | Estimated price components |
| `actual_component` | list | Actual price components |
| `include_transport_import` | bool | |
| `include_transport_export` | bool | |
| `has_transport_import_rate` | bool | |
| `has_transport_export_rate` | bool | |
| `city_transport_import` | dict | City reference |
| `city_transport_export` | dict | City reference |
| `importer_location` | dict | |
| `exporter_location` | dict | |
| `use_predefined_transport_importer_location` | bool | |
| `use_predefined_transport_exporter_location` | bool | |

---

### 2.4 QuotationFCL _(1,364 records)_
Detail for FCL sea freight quotations. Keyed by `AFCQ-XXXXXX`.

| Field | Type | Notes |
|---|---|---|
| `quotation_id` | string | |
| `quotation_freight_key` | dict (Key ref) | |
| `container_size` | string | `20GP` · `40GP` · `40HC` etc. — old records only |
| `container_type` | string | Old records only |
| `container_quantity` | int | Old records only |
| `container_total` | int | |
| `containers` | list | Individual container objects — use this, fall back to scalar fields |
| `estimate_component` | list | |
| `actual_component` | list | |
| `include_haulage_import` | bool | |
| `include_haulage_export` | bool | |
| `include_haulage_sdl_import` | bool | |
| `include_haulage_sdl_export` | bool | |
| `has_haulage_import_rate` | bool | |
| `has_haulage_export_rate` | bool | |
| `city_haulage_import` | dict | |
| `city_haulage_export` | dict | |
| `importer_location` | dict | |
| `exporter_location` | dict | |
| `use_predefined_haulage_importer_location` | bool | |
| `use_predefined_haulage_exporter_location` | bool | |

---

### 2.5 QuotationAir _(810 records)_
Detail for air freight quotations. Same field shape as QuotationLCL (transport instead of haulage).

---

### 2.6 ShipmentOrder _(2,029 records)_
Created when a confirmed quotation is converted to a live shipment. Keyed by `AFCQ-XXXXXX`.

| Field | Type | Notes |
|---|---|---|
| `shipment_order_id` | string | Same as AFCQ key |
| `quotation_id` | string | AFCQ ref |
| `quotation_key` | dict (Key ref) | |
| `company_id` | string | |
| `company_key` | dict (Key ref) | |
| `quotation_type` | string | `LCL` · `FCL` · `AIR` |
| `quotation_category` | string | `SEA` · `AIR` |
| `shipment_type` | string | |
| `transaction_type` | string | |
| `status` | int | See ShipmentOrder status codes |
| `tracking_id` | string | Random alphanumeric, also stored in ShipmentTrackingId |
| `incoterm_code` | string | |
| `origin_port_un_code` | string | |
| `destination_port_un_code` | string | |
| `shipper` | dict | `{company_id, company_contact_id, tag, ...}` |
| `consignee` | dict | Same shape as shipper |
| `notify_party` | dict | Same shape as shipper |
| `booking_confirmed` | bool | |
| `booking_files_uploaded` | bool | |
| `booking_files` | list | |
| `booking_info` | dict | `{container_operator_code, forwarding_agent, booking_reference, ...}` |
| `containers` | list | `[{container_number, seal_number}]` |
| `track_import` | bool | |
| `track_export` | bool | |
| `completed` | bool | |
| `issued_invoice` | bool | |
| `issued_taxes_duties_invoice` | bool | |
| `invoices` | list | Mirrors Quotation.invoices |
| `taxes_duties_invoices` | list | |
| `files` | list | |
| `misc` | dict | `{bill_of_lading, mbl_reference, customer_reference}` |
| `container_discharge_from_vessel_date` | NoneType / string | Always null — reserved |
| `container_unstuff_datetime` | NoneType / string | Always null — reserved |
| `last_status_updated` | string | |
| `trash` | bool | Old records only — default false |
| `user` | string | |
| `created` | string | |
| `updated` | string | |

**ShipmentOrder status codes:**
| Code | Meaning |
|---|---|
| `100` | Created |
| `110` | Booking Confirmed |
| `4110` | In Transit (label unconfirmed — verify against Vue source) |
| `10000` | Completed |

---

### 2.7 ShipmentOrderLCL / FCL / Air _(1,009 · 561 · 459 records)_
Type-specific extensions of ShipmentOrder. Each keyed by `AFCQ-XXXXXX`.

**ShipmentOrderLCL:** `shipment_order_id`, `shipment_order_key`, `quotation_lcl_key`, `transport_import` dict, `transport_export` dict

**ShipmentOrderFCL:** `shipment_order_id`, `shipment_order_key`, `quotation_fcl_key`, `haulage_import` dict, `haulage_export` dict, `notify_pull_back_ready` dict

**ShipmentOrderAir:** `shipment_order_id`, `shipment_order_key`, `quotation_air_key`, `transport_import` dict, `transport_export` dict

---

### 2.8 ShipmentWorkFlow _(2,029 records)_
One per ShipmentOrder. Tracks the operational workflow stages. Keyed by `AFCQ-XXXXXX`.

| Field | Type | Notes |
|---|---|---|
| `workflow_id` | string | Same as AFCQ key |
| `shipment_id` | string | AFCQ ref |
| `quotation_freight_key` | dict (Key ref) | |
| `company_id` | string | Use this for company lookups — not company_key |
| `transaction_type` | string | |
| `container_load` | string | |
| `incoterm` | string | |
| `workflow` | dict | Nested stage objects e.g. `vessel_in_transit: {process, meta_data: {start, end}}` |
| `workflow_meta_data` | dict | `{start: {datetime, status}, end: {datetime, status}}` |
| `completed` | bool | |
| `trash` | bool | |
| `user` | string | |
| `created` | string | |
| `updated` | string | |

---

### 2.9 ShipmentTrackingId _(2,032 records)_
Lookup table mapping random tracking IDs to AFCQ IDs. Keyed by the tracking ID itself.

| Field | Type | Notes |
|---|---|---|
| `tracking_id` | string | e.g. `AFIQAT5Q16` — also the entity key |
| `shipment_id` | string | `AFCQ-XXXXXX` |

---

### 2.10 Invoice _(658 records)_
Keyed by `INV-XXXXXX`.

| Field | Type | Notes |
|---|---|---|
| `invoice_id` | string | `INV-XXXXXX` — mirrors entity key |
| `countid` | int | Sequential counter |
| `quotation_id` | string | `AFCQ-XXXXXX` back-reference |
| `quotation_key` | dict (Key ref) | |
| `company_id` | string | |
| `company_key` | dict (Key ref) | |
| `invoice_type` | string | `SHIPMENT` · (others TBC) |
| `xero_invoice_type` | string | `ACCREC` (accounts receivable) |
| `xero_invoice_id` | string | Xero UUID |
| `xero_company_id` | string | Xero contact UUID |
| `xero_sync` | bool | |
| `status` | int | See Invoice status codes |
| `status_msg` | string | `PAID` · `DRAFT` · `SUBMITTED` · `AUTHORISED` etc. |
| `authorised` | bool | |
| `invoice_sent` | bool | |
| `currency` | string | |
| `currency_rate` | float | |
| `line_amount_type` | string | `Exclusive` · `NoTax` |
| `line_items` | list | Xero-format line items |
| `af_line_items` | list | AF-format line items (internal) |
| `old_af_items` | dict | Legacy format — preserved for historical records, never write |
| `sub_total` | float | |
| `total_tax` | float | |
| `total_discount` | float | |
| `total` | float | |
| `amount_paid` | float | |
| `amount_due` | float | |
| `amount_credited` | float | |
| `is_discounted` | bool | |
| `issued_date` | string | |
| `due_date` | string | |
| `paid_date` | string | |
| `expected_payment_date` | NoneType / string | |
| `reference` | string | AFCQ ref stored here for Xero |
| `origin` | string | `xero-webhook` · (others) |
| `has_attachments` | bool | |
| `tags` | list | |
| `trash` | bool | |
| `user` | string | |
| `created` | string | |
| `updated` | string | |

**Invoice status codes:**
| Code | Meaning |
|---|---|
| `100` | Draft |
| `200` | Submitted |
| `2001` | Authorised |
| `3001` | Sent |
| `4001` | Paid |

---

### 2.11 MasterInvoice _(468 records)_
Aggregation record grouping all invoices for a quotation. Keyed by `AFCQ-XXXXXX`.

| Field | Type | Notes |
|---|---|---|
| `quotation_id` | string | |
| `quotation_key` | dict (Key ref) | |
| `company_id` | string | |
| `company_key` | dict (Key ref) | |
| `countid` | int | |
| `invoices` | dict | `{'INV-XXXXXX': {__key__: [...]}, ...}` |
| `user` | string | |
| `updated` | string | |

---

### 2.12 Files _(1,119 records)_
Keyed by a numeric auto-ID (not AFCQ). References AFCQ via `shipment_order_id`.

| Field | Type | Notes |
|---|---|---|
| `file_id` | int | Numeric entity key |
| `shipment_order_id` | string | `AFCQ-XXXXXX` back-reference |
| `company_id` | string | |
| `category` | string | `shipments` · (others TBC) |
| `file_name` | string | e.g. `20190603_HBL.pdf` |
| `file_location` | string | Storage path e.g. `company/{hash}/shipments/AFCQ-000128` |
| `file_tags` | list | `['hbl']` · `['mbl']` · etc. |
| `file_description` | NoneType / string | |
| `file_size` | float | KB |
| `visibility` | bool | Customer-visible flag |
| `notification_sent` | bool | |
| `permission` | dict | `{role, owner}` |
| `user` | string | |
| `created` | string | |
| `updated` | string | |

---

### 2.13 PortShipmentTasks _(922 records)_
Milestone tracking at the port level per shipment.

| Field | Type | Notes |
|---|---|---|
| `port_shipment_milestone_id` | int | Entity key |
| `shipment_order_id` | string | AFCQ back-reference |
| `company_id` | string | |
| `port_un_code` | string | |
| `transaction_type` | string | |
| `milestone` | string | e.g. `import_clearance` |
| `task_level` | int | Stage depth |
| `tasks` | list | Task objects with `{user, name, start, end}` |
| `start` | dict | `{datetime, status}` |
| `end` | dict | `{datetime, status}` |
| `milestone_completed` | bool | |
| `shipment_completed` | bool | |
| `tax_charge` | NoneType / float | ⚠️ Mixed types — normalise via parseFloat() |
| `duty_charge` | NoneType / float | ⚠️ Mixed types — normalise via parseFloat() |
| `tax_duty_currency` | NoneType / string | |
| `user` | string | |
| `created` | string | |
| `updated` | string | |

---

### 2.14 Comments _(394 records)_
Operational notes on shipments. Keyed by random Firestore-style ID.

| Field | Type | Notes |
|---|---|---|
| `comment_id` | string | Random ID — entity key |
| `quotation_id` | string | AFCQ back-reference |
| `company_id` | string | |
| `company_key` | dict (Key ref) | |
| `category` | string | `shipment` · (others) |
| `message` | string | Free text |
| `restricted` | bool | Internal-only flag |
| `account_type` | string | `AFU` · `AFC` |
| `uid` | string | Firebase Auth UID |
| `first_name` | string | |
| `last_name` | string | |
| `email` | string | |
| `tags` | list | Auto-tagged e.g. `['fcl', 'import', 'fob', 'non-dg']` |
| `invoice_id` | NoneType / string | Reserved — 100% null, never populated |
| `admin_notified` | bool | Added later — absent on old records, default false |
| `customer_notified` | bool | Added later — absent on old records, default false |
| `created` | string | |

---

## 3. User & Access Kinds

### 3.1 UserAccount _(327 records)_
Keyed by Firebase Auth UID.

| Field | Type | Notes |
|---|---|---|
| `uid` | string | Firebase Auth UID — mirrors entity key |
| `email` | string | |
| `first_name` | string | |
| `last_name` | string | |
| `phone_number` | string | |
| `account_type` | string | `AFC` (staff) · `AFU` (customer) |
| `status` | bool | Active/inactive |
| `email_validated` | bool | |
| `user` | string | Email (redundant — use `email` as primary) |
| `last_login` | string | |
| `created` | string | |
| `updated` | string | |

### 3.2 UserIAM _(330 records)_
Role and access control. Keyed by Firebase Auth UID.

| Field | Type | Notes |
|---|---|---|
| `uid` | string | Firebase Auth UID |
| `role` | string | `AFC-ADMIN` · `AFC-M` · `AFU-ADMIN` |
| `account_type` | string | `AFC` · `AFU` |
| `role_key` | dict (Key ref) | Points to UserRolesTable |
| `user_account_key` | dict (Key ref) | Points to UserAccount |
| `valid_access` | bool | Use this — authoritative |
| `active` | bool | Deprecated — use `valid_access` instead |
| `user` | string | Email |
| `updated` | string | |

### 3.3 UserRolesTable _(6 records)_
| Role ID | Account Type | Role |
|---|---|---|
| `AFC-ADMIN` | AFC (staff) | Admin |
| `AFC-M` | AFC (staff) | Manager |
| `AFU-ADMIN` | AFU (customer) | Admin |
| (others TBC) | | |

### 3.4 UserDashboard _(624 records)_
Per-user cached dashboard stats. Keyed by `AFC-XXXXXX` (company key).

| Field | Type | Notes |
|---|---|---|
| `dashboard_id` | string | Company key |
| `account_type` | string | |
| `quotations` | dict/int | Aggregated quotation stats |
| `shipments` | dict/int | |
| `shipments_stats` | dict | |
| `bookings` | dict/int | |
| `invoices` | dict/int | |
| `weekly_shipments` | dict | |

### 3.5 AFUserAccount _(4 records)_
Internal AF staff accounts only (separate from customer UserAccount).

### 3.6 CompanyUserAccount _(323 records)_
Junction table linking companies to user accounts.
- `uid` — Firebase Auth UID
- `user_account_key` — Key ref to UserAccount
- `company_id` — `AFC-XXXXXX` (absent on 54% of records — guard all reads)
- `company_key` — Key ref to Company (absent on 54% of records)

---

## 4. Company Kind

### Company _(641 records)_
Keyed by `AFC-XXXXXX`.

| Field | Type | Notes |
|---|---|---|
| `company_id` | string | `AFC-XXXXXX` |
| `name` | string | |
| `short_name` | string | |
| `type` | string | Deprecated — default `'CUSTOMER'` on read |
| `registration_number` | string | |
| `countid` | int | Sequential counter for AFC ID |
| `address` | dict | |
| `contact_info` | dict | Phone, email etc. |
| `contact_persons` | list | |
| `preferred_currency` | string | |
| `approved` | bool | |
| `allow_access` | bool | |
| `xero_id` | string | Xero contact UUID |
| `xero_sync` | bool | |
| `xero_sync_required` | bool | |
| `tags` | list | |
| `files` | list | |
| `trash` | bool | |
| `user` | string | |
| `created` | string | |
| `updated` | string | |

### CompanyRates _(641 records)_
Per-company pricing markup config. Keyed by `AFC-XXXXXX`.

| Field | Type | Notes |
|---|---|---|
| `company_id` | string | |
| `company_key` | dict (Key ref) | |
| `customer_rank_key` | dict (Key ref) | |
| `markup_info` | dict | ⚠️ Server-side only — never expose to client |
| `haulage_rebate_20` | (varies) | |
| `haulage_fuel_adjustment_factor` | (varies) | |
| `user` | string | |
| `updated` | string | |

---

## 5. Pricing Kinds

| Kind | Records | Key fields |
|---|---|---|
| `PricingLCL` | 213 | `port_destination_un_code`, `kind`, `default_supplier`, `dg_class_code` |
| `PricingFCL` | 416 | `port_destination_un_code`, `container_size`, `default_supplier`, `dg_class_code` |
| `PricingAir` | 196 | `port_destination_un_code`, `airline_code`, `default_supplier` |
| `PricingHaulage` | 939 | `city_key`, `port_type`, `container_size`, `pt_group` |
| `PricingTransport` | 548 | `city_key`, `port_type`, `pt_group` |
| `PricingLocalCharges` | 1,059 | `port_type`, `transaction_type`, `container_size`, `pt_group` |
| `PricingCustomsCharges` | 304 | `port_type`, `transaction_type`, `pt_group`, `is_domestic` |
| `PricingDGClassCharges` | 50 | `dg_class_code`, `container_size`, `transaction_type` |
| `PTMonthlyRateOceanAir` | 10,000 | `pt_id`, `month_year`, `supplier_id` |
| `PTMonthlyRateHaulageTransport` | 10,000 | Monthly snapshot of haulage rates |
| `PTMonthlyRatePortCharges` | 10,000 | Monthly snapshot of port charges |

**⚠️ The three `PTMonthlyRate` Kinds** contain `cost` and `price` dicts. Cost fields must remain server-side only — never exposed to client.

---

## 6. Reference / Lookup Kinds

| Kind | Records | Purpose |
|---|---|---|
| `Port` | 337 | Port master data — `un_code`, `port_type`, `country`, geocode |
| `City` | 646 | City master data — transport origin/destination |
| `Country` | 90 | Country master data |
| `Zone` | 4 | Delivery zone definitions |
| `UnmatchedZones` | 611 | Geocode locations not yet matched to a Zone |
| `Vessel` | 228 | Vessel master data — `imo`, `mmsi`, `vessel_name` |
| `VesselSchedule` | 8,234 | Port call schedules — `vessel_key`, `un_code_port`, `eta`, `etd` |
| `Service` | 48 | Shipping service lines (carrier routes) |
| `ServicePortCall` | 400 | Port calls per Service — `sequence`, `transit_time` |
| `ServicesCarriers` | 38 | Carrier ↔ Service mapping |
| `Carrier` | 89 | Carrier master data — `scac`, `name` |
| `Airlines` | 7 | Airline master data — `iata`, `icao` |
| `SuppliersCarriers` | 9 | Supplier ↔ Carrier mapping |
| `Incoterms` | 9 | Incoterm definitions |
| `CargoType` | 22 | Cargo type definitions |
| `TransportTonnage` | 5 | Tonnage bracket definitions |
| `CurrencyConversion` | 22 | Exchange rates |
| `ProductServiceItems` | 91 | Xero product/service line items |
| `XeroAccounts` | 71 | Xero chart of accounts |
| `FileTags` | 36 | File category tag definitions |
| `Tags` | 8 | General tag definitions |
| `CustomerRank` | 2 | Customer tier / rank — ⚠️ server-side only |
| `AccountType` | 2 | `AFC` · `AFU` |

---

## 7. Internal / System Kinds

| Kind | Records | Purpose |
|---|---|---|
| `AFCryptoStore` | 1 | Encrypted secrets storage |
| `AFRedis` | 3 | Redis-equivalent cache store |
| `CompanyContactsInformation` | 18 | Additional company contact records |

---

## 8. Critical Migration Rules

### 8.1 Never touch
- The `AFCQ-XXXXXX` key format and generation logic (`countid` field on Quotation)
- The `INV-XXXXXX` key format and generation logic (`countid` field on Invoice)
- The `AFC-XXXXXX` key format and generation logic (`countid` field on Company)
- `ShipmentTrackingId` — the random tracking ID ↔ AFCQ mapping
- `old_af_items` on Invoice — legacy field, preserved for historical invoice rendering

### 8.2 Default values on read
Any field added after launch may be absent on old records. Always apply defaults:
```typescript
const adminNotified = comment.admin_notified ?? false;
const customerNotified = comment.customer_notified ?? false;
```

### 8.3 Cost/price data — server-side only
- `PTMonthlyRateOceanAir.cost` / `.lowest_cost` / `.highest_cost`
- `PTMonthlyRateHaulageTransport.cost` / `.lowest_cost` / `.highest_cost`
- `PTMonthlyRatePortCharges.cost`
- `CompanyRates.markup_info`
- `CustomerRank` — all fields
- Any `actual_component` on Quotation detail Kinds

### 8.4 Xero integration
Invoice records sync bidirectionally with Xero via webhook (`origin: 'xero-webhook'`). Xero UUID in `xero_invoice_id`. Any invoice status change must account for `xero_sync` / `xero_sync_required`.

### 8.5 Soft deletes
All major Kinds use `trash: bool`. Hard deletes not used. Always filter `trash == false`.

### 8.6 QuotationFCL container field migration
`container_size`, `container_type`, `container_quantity` present on old records only (27%). Newer records use `containers` list. On read: check `containers` first; fall back to scalar fields if list is empty.

---

## 9. Entity Relationship Summary

```
Company (AFC-XXXXXX)
  └── CompanyRates
  └── UserDashboard
  └── CompanyUserAccount → UserAccount (Firebase UID)
                              └── UserIAM → UserRolesTable

Quotation (AFCQ-XXXXXX)  ←── core spine
  ├── QuotationFreight
  │     ├── QuotationLCL
  │     ├── QuotationFCL
  │     └── QuotationAir
  ├── ShipmentOrder
  │     ├── ShipmentOrderLCL
  │     ├── ShipmentOrderFCL
  │     └── ShipmentOrderAir
  ├── ShipmentWorkFlow
  ├── MasterInvoice
  │     └── Invoice (INV-XXXXXX) ←→ Xero
  ├── Files
  ├── Comments
  └── PortShipmentTasks
        └── ShipmentTrackingId (random key → AFCQ)
```

---

## 10. Build Priority Order (Informed by Data Map)

1. **Public website** — no Datastore dependency. Safe first deployment.
2. **Auth** — Firebase Auth + UserAccount + UserIAM. Read-only.
3. **Company & User management** — Company, UserAccount, UserIAM reads.
4. **Quotation module (read)** — Validate all field reads against real data before write flows.
5. **Quotation module (write)** — Preserve `countid` increment logic exactly.
6. **Shipment tracking** — ShipmentOrder, ShipmentWorkFlow, ShipmentTrackingId reads.
7. **File management** — Files Kind reads/writes against existing storage paths.
8. **Invoice display** — Read-only first. Xero webhook integration last.
9. **Pricing module** — PTMonthlyRate Kinds. Server-side only. High sensitivity.
10. **Full Xero integration** — Bidirectional sync. Last because it touches Invoice write paths.
