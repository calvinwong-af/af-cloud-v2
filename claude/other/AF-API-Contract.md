# AcceleFreight — AF Server V2 API Contract
**Base URL:** `https://af-server-667020632236.asia-northeast1.run.app/api/v2` (prod) · `http://localhost:8000/api/v2` (local)  
**Auth:** Firebase ID token — `Authorization: Bearer <token>` on all protected routes  
**Version:** Contract v1.7 — 05 March 2026  
**Status:** Living document — update when endpoints change

---

## 0. Conventions

### 0.1 Response Envelope

All endpoints return a standard JSON envelope:

```json
{
  "status": "OK" | "ERROR",
  "data": <payload>,
  "msg": "Human-readable message"
}
```

List endpoints may omit the envelope in favour of a direct array or named top-level keys (see per-endpoint notes). This will be standardised in a future pass — for now, document the actual shape.

### 0.2 Error Responses

| HTTP Code | Meaning |
|---|---|
| `400` | Bad request — validation failed |
| `401` | Missing or expired token |
| `403` | Authenticated but forbidden (wrong role) |
| `404` | Resource not found |
| `500` | Server error |

Error body:
```json
{ "detail": "Human-readable error message" }
```

### 0.3 Auth Roles

| Role token | Who | Permissions |
|---|---|---|
| `require_auth` | Any authenticated user | Read own data |
| `require_afu` | AFU staff (any AFU role) | Read all data |
| `require_afu_admin` | AFU-ADMIN only | Write / create / delete |
| `require_super_admin` | Named super-admins only (calvin, isaac) | Dangerous ops |

**AFU Roles:** `AFU-ADMIN` · `AFU-STAFF` · `AFU-OPS`  
**AFC Roles:** `AFC-ADMIN` · `AFC-M` (Manager)

AFC users (`is_afc()`) are automatically scoped to their own `company_id` — they can never see data from other companies regardless of which endpoint they call.

### 0.4 ID Formats

| Prefix | Entity | Example |
|---|---|---|
| `AF-XXXXXX` | V2 Shipment | `AF-003873` |
| `AFCQ-XXXXXX` | V1 Shipment (migrated) | `AFCQ-003780` — resolves to `AF-003780` |
| `AFC-XXXXXX` | Company | `AFC-000412` |
| `INV-XXXXXX` | Invoice | `INV-000658` |

AFCQ- IDs are accepted transparently at the shipment endpoints — the server resolves them to the migrated AF- record.

### 0.5 Date/Datetime Format

All datetimes are ISO 8601 UTC strings: `"2026-02-28T10:32:00+00:00"`.  
Date-only fields (`cargo_ready_date`, `etd`, `eta`) are `"YYYY-MM-DD"` strings.

---

## 1. Health

### `GET /`
No auth. Used by Cloud Run health checks.

**Response:**
```json
{ "status": "OK", "version": "2.0.0", "service": "af-server" }
```

---

## 2. Shipments

Base path: `/api/v2/shipments`

### 2.1 Stats

#### `GET /shipments/stats`
Auth: `require_auth`  
Query params: `company_id` (optional, AFU only — AFC is auto-scoped)

Returns KPI counts for dashboard cards.

**Response:**
```json
{
  "status": "OK",
  "data": {
    "active": 19,
    "completed": 2010,
    "draft": 0,
    "total": 2029,
    "to_invoice": 5,
    "cancelled": 3
  },
  "msg": "Shipment stats fetched"
}
```

---

### 2.2 Search

#### `GET /shipments/search`
Auth: `require_auth`  
Query params:
- `q` (required, min 3 chars) — search term
- `limit` (default 8, max 50)
- `search_fields` — `"id"` (default) or `"all"` (id + company name + ports)

AFC users are auto-scoped. AFU sees all.

**Response:**
```json
{
  "results": [
    {
      "shipment_id": "AF-003873",
      "data_version": 2,
      "migrated_from_v1": false,
      "status": 2001,
      "status_label": "Confirmed",
      "order_type": "SEA_FCL",
      "transaction_type": "IMPORT",
      "incoterm": "FOB",
      "origin_port": "VNSGN",
      "destination_port": "MYPKG",
      "company_id": "AFC-000412",
      "company_name": "Acme Corp Sdn Bhd",
      "cargo_ready_date": "2026-02-15",
      "updated": "2026-03-01"
    }
  ],
  "total": 12,
  "next_cursor": null
}
```

---

### 2.3 List Shipments

#### `GET /shipments/`
Auth: `require_auth`  
Query params:
- `tab` — `active` (default) | `completed` | `to_invoice` | `draft` | `cancelled` | `all`
- `company_id` (optional, AFU only)
- `offset` (default 0)
- `limit` (default 25, max 100)

**Response:** (no envelope)
```json
{
  "shipments": [ <ShipmentListItem>, ... ],
  "next_cursor": "25",
  "total": 2035,
  "total_shown": 25
}
```

**ShipmentListItem shape:**
```json
{
  "shipment_id": "AF-003873",
  "data_version": 2,
  "migrated_from_v1": false,
  "status": 2001,
  "status_label": "Confirmed",
  "order_type": "SEA_FCL",
  "transaction_type": "IMPORT",
  "incoterm_code": "FOB",
  "incoterm": "FOB",
  "origin_port": "VNSGN",
  "destination_port": "MYPKG",
  "company_id": "AFC-000412",
  "company_name": "Acme Corp Sdn Bhd",
  "cargo_ready_date": "2026-02-15",
  "updated": "2026-03-01",
  "cargo_is_dg": false,
  "issued_invoice": false,
  "exception_flagged": false
}
```

---

### 2.4 Get Single Shipment

#### `GET /shipments/{shipment_id}`
Auth: `require_auth`  
Accepts `AF-XXXXXX` or `AFCQ-XXXXXX` (resolves transparently).

**Response:**
```json
{
  "status": "OK",
  "data": <ShipmentDetail>,
  "msg": "Shipment fetched"
}
```

**ShipmentDetail shape:**
```json
{
  "shipment_id": "AF-003873",
  "id": "AF-003873",
  "data_version": 2,
  "migrated_from_v1": false,
  "status": 2001,
  "status_label": "Confirmed",
  "order_type": "SEA_FCL",
  "transaction_type": "IMPORT",
  "incoterm_code": "FOB",
  "company_id": "AFC-000412",
  "company_name": "Acme Corp Sdn Bhd",
  "issued_invoice": false,
  "completed": false,
  "completed_at": null,
  "cargo_ready_date": "2026-02-15",
  "etd": "2026-03-10",
  "eta": "2026-03-25",
  "cargo": {
    "description": "Electronic Components",
    "hs_code": "8542.31",
    "is_dg": false,
    "dg_class": null,
    "dg_un_number": null
  },
  "type_details": {
    "type": "SEA_FCL",
    "containers": [
      { "container_size": "40HC", "container_type": "DRY", "quantity": 2 }
    ]
  },
  "origin": {
    "type": "PORT",
    "port_un_code": "VNSGN",
    "terminal_id": null,
    "city_id": null,
    "address": null,
    "country_code": "VN",
    "label": "VNSGN"
  },
  "destination": {
    "type": "PORT",
    "port_un_code": "MYPKG",
    "terminal_id": "MYPKG_W",
    "city_id": null,
    "address": null,
    "country_code": "MY",
    "label": "Port Klang"
  },
  "parties": {
    "shipper": {
      "name": "Supplier Vietnam Ltd",
      "address": "123 Industrial Road, Ho Chi Minh City",
      "contact_person": "Nguyen Van A",
      "phone": "+84 123 456 789",
      "email": "supply@supplier.vn",
      "company_id": null,
      "company_contact_id": null
    },
    "consignee": { ... },
    "notify_party": { ... }
  },
  "bl_document": null,
  "exception_data": {
    "flagged": false,
    "raised_at": null,
    "raised_by": null,
    "notes": null
  },
  "route_nodes": null,
  "status_history": [
    {
      "status": 2001,
      "label": "Confirmed",
      "timestamp": "2026-02-28T10:32:00+00:00",
      "changed_by": "calvin@accelefreight.com",
      "note": "Manually created"
    }
  ],
  "workflow_tasks": [ <TaskObject>, ... ],
  "creator": { "uid": "abc123", "email": "calvin@accelefreight.com" },
  "created_at": "2026-02-28T10:32:00+00:00",
  "updated_at": "2026-03-01T08:15:00+00:00"
}
```

---

### 2.5 Create Shipment

#### `POST /shipments/`
Auth: `require_afu_admin`

**Request body:**
```json
{
  "order_type": "SEA_FCL",
  "transaction_type": "IMPORT",
  "company_id": "AFC-000412",
  "origin_port_un_code": "VNSGN",
  "origin_terminal_id": null,
  "origin_label": null,
  "destination_port_un_code": "MYPKG",
  "destination_terminal_id": "MYPKG_W",
  "destination_label": "Port Klang (Westports)",
  "incoterm_code": "FOB",
  "cargo_description": "Electronic Components",
  "cargo_hs_code": "8542.31",
  "cargo_is_dg": false,
  "containers": [
    { "container_size": "40HC", "container_type": "DRY", "quantity": 2 }
  ],
  "packages": null,
  "shipper": { ... },
  "consignee": { ... },
  "notify_party": { ... },
  "cargo_ready_date": "2026-02-15",
  "etd": "2026-03-10",
  "eta": "2026-03-25"
}
```

`order_type` values: `SEA_FCL` | `SEA_LCL` | `AIR`  
`transaction_type` values: `IMPORT` | `EXPORT` | `DOMESTIC`  
`containers` required for `SEA_FCL`. `packages` for `SEA_LCL` / `AIR`.

**Response:**
```json
{
  "status": "OK",
  "data": { "shipment_id": "AF-003874" },
  "msg": "Shipment created"
}
```

---

### 2.6 Delete Shipment

#### `DELETE /shipments/{shipment_id}`
Auth: `require_afu_admin`  
Query params: `hard=false` (default) — `hard=true` for permanent deletion (irreversible)

Soft delete sets `trash=TRUE`. Hard delete removes rows from `shipments`, `shipment_workflows`, `shipment_files`.

**Response:**
```json
{ "deleted": true, "shipment_id": "AF-003874", "mode": "soft" }
```

---

### 2.7 Status

#### `PATCH /shipments/{shipment_id}/status`
Auth: `require_afu`

Updates the status and appends to status history in both `shipments` and `shipment_workflows`. Validates forward-only progression on the incoterm-aware path (Path A or Path B).

**Request body:**
```json
{
  "status": 3001,
  "allow_jump": false,
  "reverted": false
}
```

`allow_jump: true` bypasses sequence validation. `reverted: true` allows going backwards and tags the history entry.

**Status codes:**

| Code | Label |
|---|---|
| `1001` | Draft |
| `1002` | Pending Review |
| `2001` | Confirmed |
| `3001` | Booking Pending |
| `3002` | Booking Confirmed |
| `4001` | Departed |
| `4002` | Arrived |
| `5001` | Completed |
| `-1` | Cancelled |

**Path A** (booking relevant — AcceleFreight controls freight): `1002 → 2001 → 3001 → 3002 → 4001 → 4002 → 5001`  
**Path B** (booking not relevant): `1002 → 2001 → 4001 → 4002 → 5001`

**Booking relevance by incoterm + transaction_type:**

| Classification | Incoterm + Type |
|---|---|
| Path A | EXW import, FOB import, FCA import, CFR/CNF/CIF export, DDP export, DAP export, CPT export |
| Path B | FOB export, FCA export, CNF/CFR/CIF import, DDP import, DAP import, CPT import |
| Blocked | EXW export — hard blocked in UI |

**Auto-advance on document apply:**
- BC apply → advances to Booking Confirmed (3002) — unless incoterm classification puts it further (see `_resolve_document_status`)
- BL/AWB apply on Path A → advances to Booking Confirmed (3002)
- BL/AWB apply on Path B → advances to Departed (4001) if `on_board_date` ≤ today, else Booking Confirmed (3002)
- ATD set (actual departure) → auto-advances to Departed (4001) if not already there
- ATA set (actual arrival) → auto-advances to Arrived (4002) if not already there

**Response:**
```json
{
  "status": "OK",
  "data": { "shipment_id": "AF-003873", "new_status": 3001, "path": "A" },
  "msg": "Status updated"
}
```

---

#### `GET /shipments/{shipment_id}/status-history`
Auth: `require_auth`

**Response:**
```json
{
  "status": "OK",
  "history": [
    {
      "status": 2001,
      "label": "Confirmed",
      "timestamp": "2026-02-28T10:32:00+00:00",
      "changed_by": "calvin@accelefreight.com",
      "note": "Manually created"
    }
  ]
}
```

---

### 2.8 Completed Flag

#### `PATCH /shipments/{shipment_id}/complete`
Auth: `require_afu`  
Shipment must be at status `3002` (Booking Confirmed) or beyond to mark as completed. Sets/clears a separate `completed` boolean and `completed_at` timestamp — independent of the numeric status field.

**Request body:**
```json
{ "completed": true, "note": "All charges cleared" }
```

`note` is optional.

**Response:**
```json
{
  "status": "OK",
  "data": {
    "completed": true,
    "completed_at": "2026-03-05T10:00:00+00:00"
  }
}
```

⚠️ `completed` is a separate flag from `status`. A shipment at status 4002 (Arrived) can be marked completed. Uncompleting clears `completed_at`.

---

### 2.9 Invoiced Flag

#### `PATCH /shipments/{shipment_id}/invoiced`
Auth: `require_afu`  
Shipment must have `completed = TRUE`.

**Request body:**
```json
{ "issued_invoice": true }
```

**Response:**
```json
{
  "status": "OK",
  "data": { "issued_invoice": true },
  "msg": "Invoiced status updated"
}
```

⚠️ Gate changed from `status=5001` to `completed=TRUE` — the `5001` status code is retained for backward compatibility but `completed` is the actual gate.

---

### 2.10 Exception Flag

#### `PATCH /shipments/{shipment_id}/exception`
Auth: `require_auth` (AFC: admin/manager only; AFU: all)

**Request body:**
```json
{ "flagged": true, "notes": "Container damaged on arrival" }
```

**Response:**
```json
{
  "status": "OK",
  "data": {
    "exception": {
      "flagged": true,
      "raised_at": "2026-03-01T09:00:00+00:00",
      "raised_by": "abc123",
      "notes": "Container damaged on arrival"
    }
  },
  "msg": "Exception raised"
}
```

---

### 2.11 Reassign Company

#### `PATCH /shipments/{shipment_id}/company`
Auth: `require_afu`

**Request body:**
```json
{ "company_id": "AFC-000413" }
```

**Response:**
```json
{
  "status": "OK",
  "data": { "company_id": "AFC-000413", "company_name": "Beta Corp Sdn Bhd" },
  "msg": "Company reassigned"
}
```

---

### 2.12 Update Booking / Transport Fields

#### `PATCH /shipments/{shipment_id}/booking`
Auth: `require_afu`

Partial update of booking and transport fields. Merges into the `booking` JSONB on `shipment_details` and optionally updates flat AWB columns. All fields optional — only explicitly provided fields are written.

**Request body:**
```json
{
  "booking_reference": "COSCO-BK-001",
  "carrier_agent": "COSCO Shipping Lines",
  "vessel_name": "CSCL GLOBE",
  "voyage_number": "V0123",
  "mawb_number": null,
  "hawb_number": null,
  "awb_type": null,
  "flight_number": null,
  "flight_date": null
}
```

Sea/booking fields (`booking_reference`, `carrier_agent`, `vessel_name`, `voyage_number`, `flight_number`, `flight_date`) are stored in the `booking` JSONB on `shipment_details`.  
Air fields (`mawb_number`, `hawb_number`, `awb_type`) are flat columns on `shipment_details`.  
Empty string (`""`) clears a field.

**Response:** `{ "status": "OK", "msg": "Booking updated" }`

---

### 2.13 Update Incoterm

#### `PATCH /shipments/{shipment_id}/incoterm`
Auth: `require_afu`

**Request body:**
```json
{ "incoterm_code": "FOB" }
```

`incoterm_code: null` clears the value.

**Response:** `{ "status": "OK", "msg": "Incoterm updated" }`

⚠️ Status correction after incoterm change is manual — the server does not retroactively recompute path or auto-advance status.

---

### 2.14 Update Port

#### `PATCH /shipments/{shipment_id}/port`
Auth: `require_afu`

Updates origin or destination port on an existing shipment. Also updates the corresponding route node if one is saved.

**Request body:**
```json
{
  "field": "origin_port_un_code",
  "port_un_code": "SGSIN",
  "terminal_id": null
}
```

`field` must be `"origin_port_un_code"` or `"destination_port_un_code"`.

**Response:** `{ "status": "OK" }`

---

### 2.15 Update Cargo (DG Flag)

#### `PATCH /shipments/{shipment_id}/cargo`
Auth: `require_afu_admin`

Updates the `is_dg` (dangerous goods) flag and optional `dg_description` on the shipment cargo JSONB.

**Request body:**
```json
{ "is_dg": true, "dg_description": "Class 3 Flammable Liquid" }
```

`dg_description` is optional.

**Response:** `{ "status": "OK", "data": { "is_dg": true } }`

---

### 2.16 Bill of Lading (BL) & Document Parsing

#### `POST /shipments/parse-bl`
Auth: `require_afu`  
Request: `multipart/form-data` with `file` field (PDF, PNG, JPEG, or WebP).

Classifies the document (BL / AWB / Booking Confirmation) then extracts structured fields via Claude API. Returns parsed data + derived port codes + company matches.

**Response:**
```json
{
  "parsed": {
    "waybill_number": "COSCO12345678",
    "booking_number": "COSCO12345678",
    "carrier_agent": "COSCO Shipping Lines",
    "vessel_name": "CSCL GLOBE",
    "voyage_number": "V0123",
    "port_of_loading": "Ho Chi Minh City",
    "port_of_discharge": "Port Klang",
    "on_board_date": "2026-03-10",
    "freight_terms": "PREPAID",
    "shipper_name": "Supplier Vietnam Ltd",
    "shipper_address": "123 Industrial Rd, HCMC",
    "consignee_name": "Acme Corp Sdn Bhd",
    "consignee_address": "...",
    "notify_party_name": null,
    "cargo_description": "Electronic Components",
    "total_weight_kg": 5000.0,
    "total_packages": "20 PALLETS",
    "delivery_status": null,
    "containers": [
      {
        "container_number": "COSCU1234567",
        "container_type": "40HC",
        "seal_number": "SL001",
        "packages": "20",
        "weight_kg": 5000.0
      }
    ],
    "cargo_items": null
  },
  "doc_type": "BL",
  "order_type": "SEA_FCL",
  "origin_un_code": "VNSGN",
  "origin_parsed_label": "Ho Chi Minh City",
  "destination_un_code": "MYPKG",
  "destination_parsed_label": "Port Klang",
  "initial_status": 4001,
  "company_matches": [
    { "company_id": "AFC-000412", "name": "Acme Corp Sdn Bhd", "score": 0.95 }
  ]
}
```

`doc_type` values: `BL` | `AWB` | `BOOKING_CONFIRMATION`  
For `AWB` responses, `parsed` contains AWB-specific fields (`origin_iata`, `dest_iata`, `mawb_number`, `hawb_number`, `awb_type`, etc.).  
For `BOOKING_CONFIRMATION` responses, `parsed` is normalised into the BL shape (`waybill_number` = booking reference, containers use `container_type` for size).

---

#### `POST /shipments/create-from-bl`
Auth: `require_afu`

**Request body:**
```json
{
  "order_type": "SEA_FCL",
  "transaction_type": "IMPORT",
  "incoterm_code": "CNF",
  "company_id": "AFC-000412",
  "origin_port_un_code": "VNSGN",
  "origin_terminal_id": null,
  "origin_label": "Ho Chi Minh City",
  "destination_port_un_code": "MYPKG",
  "destination_terminal_id": "MYPKG_W",
  "destination_label": "Port Klang (Westports)",
  "cargo_description": "Electronic Components",
  "cargo_weight_kg": 5000.0,
  "etd": "2026-03-10",
  "initial_status": 3002,
  "carrier": "COSCO",
  "waybill_number": "COSCO12345678",
  "vessel_name": "CSCL GLOBE",
  "voyage_number": "V0123",
  "shipper_name": "Supplier Vietnam Ltd",
  "shipper_address": "123 Industrial Rd, HCMC",
  "consignee_name": "Acme Corp Sdn Bhd",
  "consignee_address": "...",
  "notify_party_name": null,
  "containers": [
    { "container_number": "COSCU1234567", "container_type": "40HC", "seal_number": "SL001" }
  ],
  "customer_reference": null,
  "mawb_number": null,
  "hawb_number": null,
  "awb_type": null,
  "flight_number": null,
  "flight_date": null,
  "pieces": null,
  "chargeable_weight_kg": null
}
```

**Response:** `{ "status": "OK", "data": { "shipment_id": "AF-003874" }, "msg": "Shipment created from BL" }`

---

#### `PATCH /shipments/{shipment_id}/bl`
Auth: `require_afu`  
Request: `multipart/form-data`

Apply parsed BL data to an existing shipment. Merges booking fields, parties, containers/cargo_items, and optionally uploads the BL file. Auto-advances status based on incoterm classification.

**Form fields:**

| Field | Type | Notes |
|---|---|---|
| `waybill_number` | string | Booking reference / BL number |
| `carrier` | string | Fallback if `carrier_agent` not set |
| `carrier_agent` | string | Preferred — stored as `booking.carrier_agent` |
| `vessel_name` | string | |
| `voyage_number` | string | |
| `etd` | string | YYYY-MM-DD — BL on_board_date (actual departure) |
| `shipper_name` | string | |
| `shipper_address` | string | |
| `consignee_name` | string | |
| `consignee_address` | string | |
| `notify_party_name` | string | |
| `bl_shipper_name` | string | Raw parsed value — stored in `bl_document` |
| `bl_shipper_address` | string | Raw parsed value — stored in `bl_document` |
| `bl_consignee_name` | string | Raw parsed value — stored in `bl_document` |
| `bl_consignee_address` | string | Raw parsed value — stored in `bl_document` |
| `containers` | JSON string | Array of container objects (FCL) |
| `cargo_items` | JSON string | Array of cargo line items (LCL) |
| `cargo_description` | string | Overwrites `cargo.description` |
| `total_weight_kg` | string | Overwrites `cargo.weight_kg` |
| `lcl_container_number` | string | Consolidation container number (LCL only) |
| `lcl_seal_number` | string | Consolidation seal number (LCL only) |
| `origin_port` | string | UN code — updates flat `origin_port` |
| `dest_port` | string | UN code — updates flat `dest_port` |
| `origin_terminal` | string | Terminal ID |
| `dest_terminal` | string | Terminal ID |
| `force_update` | string | `"true"` to overwrite existing party data |
| `file` | binary | Optional BL PDF — auto-saved with tag `bl` |

**Response:**
```json
{
  "status": "OK",
  "data": {
    "shipment_id": "AF-003873",
    "booking": { "booking_reference": "COSCO12345678", "vessel_name": "CSCL GLOBE", ... },
    "parties": { "shipper": { ... }, "consignee": { ... } },
    "bl_document": { "shipper": { ... }, "consignee": { ... } },
    "origin_port": "VNSGN",
    "dest_port": "MYPKG",
    "new_status": 4001
  },
  "msg": "Shipment updated from BL"
}
```

---

#### `PATCH /shipments/{shipment_id}/parties`
Auth: `require_afu`

**Request body:**
```json
{
  "shipper_name": "Updated Shipper Ltd",
  "shipper_address": "456 New St, HCMC",
  "consignee_name": null,
  "consignee_address": null,
  "notify_party_name": null,
  "notify_party_address": null
}
```

Empty string (`""`) clears the field. `null` / omitted = no change.

**Response:** `{ "status": "OK", "data": { "parties": { ... } } }`

---

#### `PATCH /shipments/{shipment_id}/clear-parsed-diff`
Auth: `require_afu`

Clears parsed party data from `bl_document` after the user resolves a party diff (keeps current values or applies BL values). Prevents stale diff banners from re-appearing.

**Request body:**
```json
{ "party": "shipper" }
```

`party` values: `"shipper"` | `"consignee"` | `"all"`

**Response:** `{ "status": "OK" }`

---

#### `POST /shipments/{shipment_id}/apply-booking-confirmation`
Auth: `require_afu`

Apply booking confirmation data to an existing shipment. Updates `booking` JSONB, flat ETD/ETA, route node timings, `type_details.containers`. Auto-advances status based on incoterm classification.

**Request body:**
```json
{
  "booking_reference": "COSCO-BK-001",
  "carrier": "COSCO",
  "vessel_name": "CSCL GLOBE",
  "voyage_number": "V0123",
  "pol_code": "VNSGN",
  "pod_code": "MYPKG",
  "etd": "2026-03-10",
  "eta_pod": "2026-03-25",
  "containers": [{ "size": "40HC", "quantity": 2 }],
  "cargo_description": null,
  "hs_code": null,
  "cargo_weight_kg": null,
  "shipper_name": null
}
```

`shipper_name` is optional — if provided, written to `bl_document.shipper`.

**Response:** `{ "shipment_id": "AF-003873", "status": "OK", "new_status": 3002 }`

⚠️ `new_status` reflects incoterm-aware classification — typically 3002 for booking confirmations.

---

#### `POST /shipments/{shipment_id}/apply-awb`
Auth: `require_afu`

Apply AWB data to an existing AIR shipment.

**Request body:**
```json
{
  "awb_type": "HAWB",
  "hawb_number": "AF-AWB-001",
  "mawb_number": "618-12345678",
  "shipper_name": "Supplier Ltd",
  "shipper_address": "...",
  "consignee_name": "Acme Corp Sdn Bhd",
  "consignee_address": "...",
  "notify_party": null,
  "origin_iata": "SGN",
  "dest_iata": "KUL",
  "flight_number": "MH-712",
  "flight_date": "2026-03-10",
  "pieces": 50,
  "gross_weight_kg": 500.0,
  "chargeable_weight_kg": 520.0,
  "cargo_description": "Electronic Components",
  "hs_code": "8542.31"
}
```

**Response:** `{ "shipment_id": "AF-003873", "status": "OK", "new_status": 4001 }`

`new_status` is incoterm-aware. If `flight_date` is today or past, ATD check may further advance to Departed (4001).

---

#### `POST /shipments/{shipment_id}/save-document-file`
Auth: `require_afu`  
Request: `multipart/form-data` with `file` (binary) and `doc_type` (string: `AWB` | `BC` | `BL`).

Saves an uploaded document to GCS and creates a `shipment_files` record.

⚠️ **Deprecated for frontend use** — `PATCH /bl` now saves the BL file inline. For AWB and BC, the frontend calls `POST /files` directly after a successful apply. This endpoint is retained for compatibility only.

**Response:** `{ "status": "OK", "data": <FileRecord> }`

---

### 2.17 Shipment Files

#### `GET /shipments/{shipment_id}/files`
Auth: `require_auth`  
AFC regular users only see files with `visibility=true`. AFC Admin/Manager and AFU see all.

**Response:**
```json
{
  "status": "OK",
  "data": [
    {
      "id": 1234,
      "shipment_id": "AF-003873",
      "file_name": "HBL_AF003873.pdf",
      "file_location": "company/hash/shipments/AF-003873/HBL_AF003873.pdf",
      "file_size_kb": 245.3,
      "file_tags": ["hbl"],
      "visibility": true,
      "trash": false,
      "created_at": "2026-02-28T12:00:00+00:00",
      "updated_at": "2026-02-28T12:00:00+00:00"
    }
  ]
}
```

#### `POST /shipments/{shipment_id}/files`
Auth: `require_auth` (AFU all; AFC Admin/Manager only)  
Request: `multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `file` | binary | Required |
| `file_tags` | JSON string | e.g. `["hbl", "mbl"]`. Default `[]` |
| `visibility` | string | `"true"` or `"false"`. Default `"true"` |

**Response:** `{ "status": "OK", "data": <FileRecord>, "msg": "File uploaded" }`

#### `GET /shipments/{shipment_id}/files/{file_id}/download`
Auth: `require_auth`  
Generates a 15-minute signed GCS URL.

**Response:** `{ "download_url": "https://storage.googleapis.com/...?X-Goog-Signature=..." }`

#### `PATCH /shipments/{shipment_id}/files/{file_id}`
Auth: `require_auth` (AFU all; AFC Admin/Manager only)

**Request body:** `{ "file_tags": ["hbl"], "visibility": true }`

⚠️ AFC Admin/Manager cannot change `visibility` — AFU only.

**Response:** `{ "status": "OK", "data": <FileRecord>, "msg": "File updated" }`

#### `DELETE /shipments/{shipment_id}/files/{file_id}`
Auth: `require_afu`  
Soft delete only — sets `trash=TRUE`.

**Response:** `{ "deleted": true, "file_id": 1234 }`

---

### 2.18 Workflow Tasks

#### `GET /shipments/{shipment_id}/tasks`
Auth: `require_auth`  
Auto-generates tasks on first access. AFC regular users have `HIDDEN` tasks filtered out.

**Response:** (no envelope)
```json
{
  "shipment_id": "AF-003873",
  "tasks": [ <TaskObject>, ... ]
}
```

#### `PATCH /shipments/{shipment_id}/tasks/{task_id}`
Auth: `require_auth`  
Permissions: AFU — all fields. AFC Admin/Manager — all except `visibility`. AFC regular — 403.

**Request body:** (all optional)
```json
{
  "status": "completed",
  "mode": "ASSIGNED",
  "assigned_to": "AF",
  "third_party_name": null,
  "due_date": "2026-03-05",
  "due_date_override": true,
  "notes": "Booking confirmed with COSCO",
  "visibility": "VISIBLE",
  "scheduled_start": null,
  "scheduled_end": null,
  "actual_start": null,
  "actual_end": null
}
```

**Auto status progression (new):**
- TRACKED `POL` task with `actual_end` set → auto-advances shipment to Departed (4001)
- TRACKED `POD` task with `actual_start` set → auto-advances shipment to Arrived (4002)

**Response:** `{ "status": "OK", "data": <TaskObject>, "msg": "Task updated", "warning": "..." (optional) }`

⚠️ If `FREIGHT_BOOKING` task is completed but `booking_reference` is not set, `warning` is returned and `EXPORT_CLEARANCE` remains BLOCKED.

---

### 2.19 Route Nodes

#### `GET /shipments/{shipment_id}/route-nodes`
Auth: `require_auth`

**Response:** (no envelope)
```json
{
  "shipment_id": "AF-003873",
  "route_nodes": [
    {
      "port_un_code": "VNSGN",
      "port_name": "Ho Chi Minh City",
      "country": "VN",
      "port_type": "SEA",
      "role": "ORIGIN",
      "sequence": 1,
      "scheduled_eta": null,
      "actual_eta": null,
      "scheduled_etd": "2026-03-10",
      "actual_etd": null
    }
  ],
  "derived": true
}
```

`derived: true` — nodes inferred from port fields, not explicitly saved.

#### `PUT /shipments/{shipment_id}/route-nodes`
Auth: `require_auth` (AFC Admin/Manager or AFU)  
Replaces full route nodes array. Syncs ORIGIN `scheduled_etd` → flat `etd`, DESTINATION `scheduled_eta` → flat `eta`.

**Request body:** Array of node objects (role: `ORIGIN` | `TRANSHIP` | `DESTINATION`).

**Response:** `{ "shipment_id": "AF-003873", "route_nodes": [ ... ] }`

#### `PATCH /shipments/{shipment_id}/route-nodes/{sequence}`
Auth: `require_auth` (AFC Admin/Manager or AFU)

**Request body:** `{ "scheduled_eta", "actual_eta", "scheduled_etd", "actual_etd" }` (all optional)

**Auto status progression (new):**
- `actual_etd` set on ORIGIN node → auto-advances to Departed (4001)
- `actual_eta` set on DESTINATION node → auto-advances to Arrived (4002)

**Response:**
```json
{
  "shipment_id": "AF-003873",
  "node": { ... },
  "auto_status_changed": true,
  "new_status": 4001
}
```

---

### 2.20 File Tags

#### `GET /shipments/file-tags`
Auth: `require_auth`

**Response:**
```json
{
  "status": "OK",
  "data": [ { "tag_id": "hbl", "name": "House Bill of Lading", "color": "#3b9eff" } ]
}
```

---

## 3. Companies

Base path: `/api/v2/companies`

### 3.1 List Companies

#### `GET /companies`
Auth: `require_afu`  
Query params: `search` (optional), `limit` (default 200, max 500)

**Response:**
```json
{
  "status": "OK",
  "data": [ <CompanyRecord>, ... ],
  "msg": "200 companies"
}
```

### 3.2 Company Stats

#### `GET /companies/stats`
Auth: `require_afu`

**Response:**
```json
{
  "status": "OK",
  "data": { "total": 641, "approved": 589, "with_access": 412, "xero_synced": 398 }
}
```

### 3.3 Get Company

#### `GET /companies/{company_id}`
Auth: `require_auth`

**Response:**
```json
{
  "status": "OK",
  "data": {
    "company_id": "AFC-000412",
    "id": "AFC-000412",
    "name": "Acme Corp Sdn Bhd",
    "short_name": "Acme",
    "account_type": "AFC",
    "email": "admin@acme.com",
    "phone": "+60 3 1234 5678",
    "address": { "line1": "Suite 5A, Menara ABC", "city": "Petaling Jaya", "state": "Selangor", "postcode": "47810", "country": "Malaysia" },
    "xero_contact_id": "uuid...",
    "approved": true,
    "has_platform_access": true,
    "trash": false,
    "created_at": "2023-01-15T08:00:00+00:00",
    "updated_at": "2026-02-01T10:00:00+00:00"
  }
}
```

### 3.4 Create Company

#### `POST /companies`
Auth: `require_afu_admin`

**Request body:**
```json
{
  "id": "AFC-000642",
  "name": "New Logistics Sdn Bhd",
  "short_name": "NewLog",
  "account_type": "AFC",
  "email": "info@newlog.com",
  "phone": "+60 3 9876 5432"
}
```

**Response:** `{ "status": "OK", "data": { "company_id": "AFC-000642", "name": "New Logistics Sdn Bhd" }, "msg": "Company created" }`

### 3.5 Update Company

#### `PATCH /companies/{company_id}`
Auth: `require_afu`  
Updatable fields: `name`, `short_name`, `email`, `phone`, `approved`, `has_platform_access`.

**Response:** `{ "status": "OK", "msg": "Company updated" }`

---

## 4. Users

Base path: `/api/v2/users`

### User Record Shape

```json
{
  "uid": "firebase_uid_abc",
  "email": "user@company.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+60 12 345 6789",
  "account_type": "AFC",
  "role": "AFC-M",
  "company_id": "AFC-000412",
  "company_name": "Acme Corp Sdn Bhd",
  "valid_access": true,
  "validated": false,
  "last_login": null,
  "created_at": "2024-06-01T08:00:00+00:00"
}
```

`company_name` resolved from `companies.short_name` (falls back to `companies.name`). `validated` = `email_validated` column.

### 4.1 Get Current User

#### `GET /users/me`
Auth: `require_auth`

**Response:** `{ "status": "OK", "data": <UserRecord> }`

### 4.2 List Users

#### `GET /users`
Auth: `require_afu_admin`  
Returns all users — AFU first, then alphabetical by last name.

**Response:** `{ "status": "OK", "data": [ <UserRecord>, ... ] }`

### 4.3 Create User

#### `POST /users`
Auth: `require_afu_admin`

**Request body:**
```json
{
  "email": "newuser@company.com",
  "password": "InitialPassword123!",
  "first_name": "Jane",
  "last_name": "Smith",
  "phone_number": "+60 12 345 6789",
  "account_type": "AFC",
  "role": "AFC-M",
  "company_id": "AFC-000412"
}
```

`phone_number` and `company_id` are optional.

**Response:** `{ "status": "OK", "data": { "uid": "firebase_uid_abc" } }`

**Errors:** `409` — email exists. `400` — weak password or invalid email.

### 4.4 Update User

#### `PATCH /users/{uid}`
Auth: `require_afu_admin`  
Updatable: `first_name`, `last_name`, `phone_number`, `role`, `valid_access`, `company_id`. Syncs to Firebase Auth.

⚠️ `valid_access: false` disables Firebase Auth immediately.

**Response:** `{ "status": "OK" }`

### 4.5 Delete User

#### `DELETE /users/{uid}`
Auth: `require_afu_admin`  
Permanently deletes from Firebase Auth and `users` table.

**Response:** `{ "status": "OK" }`

### 4.6 Reset Password

#### `POST /users/{uid}/reset-password`
Auth: `require_afu_admin`

**Request body:** `{ "new_password": "NewSecure456!" }`

**Response:** `{ "status": "OK" }`

### 4.7 Send Password Reset Email

#### `POST /users/{uid}/send-reset-email`
Auth: `require_afu_admin`

**Response:** `{ "status": "OK" }`

**Errors:** `404` — user not found. `400` — no email. `502` — Firebase call failed.

### 4.8 Promote to Staff

#### `PATCH /users/{uid}/promote-to-staff`
Auth: `require_afu_admin`

Promotes a customer (AFC) user to an internal staff (AFU) account. Sets `account_type = 'AFU'`, assigns role, and clears `company_id`.

**Request body:**
```json
{ "role": "AFU-STAFF" }
```

`role` must be one of: `AFU-ADMIN` | `AFU-STAFF` | `AFU-OPS`

**Response:** `{ "status": "OK" }`

**Errors:** `400` — invalid role or user is already AFU. `404` — user not found.

---

## 5. Geography

Base path: `/api/v2/geography`

### 5.1 List Ports

#### `GET /geography/ports`
Auth: `require_auth` · 10-minute cache

**Response shape per port:**
```json
{
  "un_code": "MYPKG",
  "name": "Port Klang",
  "country": "Malaysia",
  "country_code": "MY",
  "port_type": "SEA",
  "has_terminals": true,
  "terminals": [
    { "terminal_id": "MYPKG_W", "name": "Westports", "label": "Westports" },
    { "terminal_id": "MYPKG_N", "name": "Northport", "label": "Northport" }
  ],
  "lat": 2.9996,
  "lng": 101.3851
}
```

`lat` / `lng` are `number | null`. Legacy ports without coordinates return `null`.

### 5.2 Get Port

#### `GET /geography/ports/{un_code}`
Auth: `require_auth`  
Returns single port. Same shape as list item above.

### 5.3 Update Port Coordinates

#### `PATCH /geography/ports/{un_code}`
Auth: `require_afu`

**Request body:** `{ "lat": 2.9996, "lng": 101.3851 }`

Both fields are optional/nullable. Invalidates port cache on success.

**Response:** `{ "status": "OK" }`

---

### 5.4 States

#### `GET /geography/states`
Auth: `require_auth` · 10-minute cache  
Returns active states only.

**Response shape per state:** `{ "state_code": "MY-SGR", "name": "Selangor", "country_code": "MY", "is_active": true }`

#### `GET /geography/states/{state_code}`
Auth: `require_auth`

---

### 5.5 Cities

#### `GET /geography/cities`
Auth: `require_auth` · 10-minute cache (bypassed when `?state_code=` filter applied)  
Query params: `state_code` (optional)

**Response shape per city:**
```json
{
  "city_id": 1,
  "name": "Shah Alam",
  "state_code": "MY-SGR",
  "state_name": "Selangor",
  "lat": 3.073050,
  "lng": 101.518200,
  "is_active": true
}
```

#### `GET /geography/cities/{city_id}`
Auth: `require_auth`

#### `POST /geography/cities`
Auth: `require_afu`

**Request body:** `{ "name": "Shah Alam", "state_code": "MY-SGR", "lat": 3.073050, "lng": 101.518200 }`  
`lat` and `lng` optional. Validates `state_code` exists.

**Response:** `{ "status": "OK", "data": { "city_id": 1, "name": "Shah Alam" } }`

#### `PATCH /geography/cities/{city_id}`
Auth: `require_afu`  
Updatable: `name`, `is_active`, `lat`, `lng`.

**Response:** `{ "status": "OK" }`

---

### 5.6 Areas

⚠️ **Renamed from `haulage-areas`** — all endpoints now use `/geography/areas`. Callers on the old `/geography/haulage-areas/*` path must update.

#### `GET /geography/areas`
Auth: `require_auth` · No cache  
Query params: `port_un_code` (optional), `state_code` (optional)

**Response shape per area:**
```json
{
  "area_id": 1,
  "area_code": "KL035",
  "area_name": "Klang / Shah Alam",
  "port_un_code": "MYPKG",
  "state_code": "MY-SGR",
  "city_id": 1,
  "city_name": "Shah Alam",
  "lat": 3.073050,
  "lng": 101.518200,
  "is_active": true
}
```

#### `GET /geography/areas/{area_id}`
Auth: `require_auth`

#### `POST /geography/areas`
Auth: `require_afu`

**Request body:**
```json
{
  "area_code": "KL035",
  "area_name": "Klang / Shah Alam",
  "port_un_code": "MYPKG",
  "state_code": "MY-SGR",
  "city_id": 1,
  "lat": null,
  "lng": null
}
```

`state_code`, `city_id`, `lat`, `lng` optional. `area_code` stored uppercase.

**Response:** `{ "status": "OK", "data": { "area_id": 1, "area_code": "KL035" } }`

#### `PATCH /geography/areas/{area_id}`
Auth: `require_afu`  
Updatable: `area_code`, `area_name`, `port_un_code`, `state_code`, `city_id`, `lat`, `lng`. All optional.

**Response:** `{ "status": "OK" }`

#### `DELETE /geography/areas/{area_id}`
Auth: `require_afu`  
Soft delete — sets `is_active = FALSE`.

**Response:** `{ "status": "OK" }`

---

### 5.7 Port Resolution (AI-Assisted)

#### `POST /geography/ports/resolve`
Auth: `require_afu`

**Request body:** `{ "code": "MUC" }`

**Response:**
```json
{
  "status": "OK",
  "already_exists": false,
  "candidate": {
    "un_code": "DEMUC",
    "name": "Munich Airport",
    "country": "Germany",
    "country_code": "DE",
    "port_type": "AIR",
    "lat": 48.353802,
    "lng": 11.786085,
    "confidence": "HIGH"
  }
}
```

`confidence` values: `HIGH` | `LOW`

#### `POST /geography/ports/confirm`
Auth: `require_afu`

Inserts resolved port into `ports` table and invalidates cache.

**Request body:** Full candidate object (all fields from resolve response, minus `confidence`).

**Response:** Full port record (same shape as `GET /geography/ports/{un_code}`).

**Errors:** `409` — port already exists.

---

### 5.8 Countries

#### `GET /geography/countries`
Auth: `require_auth` · 10-minute cache  
Returns all active countries ordered by name.

**Response shape per country:**
```json
{
  "country_code": "MY",
  "name": "Malaysia",
  "currency_code": "MYR",
  "tax_label": "SST",
  "tax_rate": 8.0,
  "tax_applicable": true,
  "is_active": true
}
```

#### `GET /geography/countries/{country_code}`
Auth: `require_auth`

Returns single country. Same shape as list item above.

#### `PATCH /geography/countries/{country_code}`
Auth: `require_afu`

Update tax and currency fields. Country `name` is not updatable via API.

**Request body:** (all optional)
```json
{
  "currency_code": "MYR",
  "tax_label": "SST",
  "tax_rate": 8.0,
  "tax_applicable": true,
  "is_active": true
}
```

**Response:** `{ "status": "OK" }`

---

## 6. Ports (Legacy Endpoint)

Base path: `/api/v2/ports`  
**Note:** Unauthenticated version of the geography ports endpoint. Use `/geography/ports` for authenticated callers. Retained for backward compatibility.

#### `GET /ports`
No auth. Returns all ports (same shape as `/geography/ports` list items, including `lat`/`lng`).

#### `GET /ports/{un_code}`
No auth. Returns single port.

---

## 7. Files

Base path: `/api/v2/files`  
**Status:** Stub only — `GET /files/upload-url` returns `null`. All active file operations are under `/shipments/{id}/files`.

---

## 8. AI

Base path: `/api/v2/ai`

### `POST /ai/parse-document`
Auth: `require_auth`

General-purpose freight document parser. Accepts a base64-encoded PDF and an optional hint. Classifies the document then extracts structured fields in a single response. Unlike `POST /shipments/parse-bl`, this endpoint uses async Claude API calls and accepts base64 input (not multipart). Intended for use by the af-platform's document upload modal.

**Request body:**
```json
{
  "file_base64": "<base64 encoded PDF>",
  "file_name": "HBL_001.pdf",
  "hint": "BL"
}
```

`hint` is optional. Values: `"BL"` | `"AWB"` | `"BOOKING_CONFIRMATION"`. If provided, skips the classification step.

**Response:**
```json
{
  "status": "OK",
  "doc_type": "BL",
  "confidence": "HIGH",
  "data": {
    "waybill_number": "COSCO12345678",
    "booking_number": null,
    "carrier_agent": "COSCO Shipping Lines",
    "vessel_name": "CSCL GLOBE",
    "voyage_number": "V0123",
    "port_of_loading": "Ho Chi Minh City",
    "port_of_discharge": "Port Klang",
    "on_board_date": "2026-03-10",
    "freight_terms": "PREPAID",
    "shipper_name": "Supplier Vietnam Ltd",
    "shipper_address": "...",
    "consignee_name": "Acme Corp Sdn Bhd",
    "consignee_address": "...",
    "notify_party_name": null,
    "cargo_description": "Electronic Components",
    "total_weight_kg": 5000.0,
    "total_packages": "20 PALLETS",
    "delivery_status": null,
    "containers": [
      {
        "container_number": "COSCU1234567",
        "container_type": "40HC",
        "seal_number": "SL001",
        "packages": "20",
        "weight_kg": 5000.0
      }
    ],
    "cargo_items": null,
    "pol_code": "VNSGN",
    "pod_code": "MYPKG"
  }
}
```

**doc_type values:** `BL` | `AWB` | `BOOKING_CONFIRMATION` | `UNKNOWN`  
**confidence values:** `HIGH` | `MEDIUM` | `LOW`

For `AWB`, `data` contains AWB-specific fields: `awb_type`, `hawb_number`, `mawb_number`, `origin_iata`, `dest_iata`, `flight_number`, `flight_date`, `pieces`, `gross_weight_kg`, `chargeable_weight_kg`.  
For `BOOKING_CONFIRMATION`, `data` contains BC fields: `booking_reference`, `carrier`, `pol_name`, `pol_code`, `pod_name`, `pod_code`, `etd`, `eta_pol`, `eta_pod`, `cut_off_date`, `containers`.  
For `UNKNOWN`, `data` is `{}`.

Port codes (`pol_code`, `pod_code`) are resolved from the `ports` table where possible (non-fatal — omitted if resolution fails).

**Errors:**
- `503` — Claude API timeout (retry)
- `500` — `ANTHROPIC_API_KEY` not configured
- `{"status": "ERROR", ...}` — Claude returned invalid JSON (soft error, not HTTP 4xx)

---

## 9. Data Objects — Reference Shapes

### 9.1 Party Object
```json
{
  "name": "Supplier Name Ltd",
  "address": "123 Main St, City, Country",
  "contact_person": "Person Name",
  "phone": "+60 12 345 6789",
  "email": "person@company.com",
  "company_id": "AFC-000412",
  "company_contact_id": null
}
```

### 9.2 Container Object
```json
{
  "container_size": "40HC",
  "container_type": "DRY",
  "quantity": 2,
  "container_number": "COSCU1234567",
  "seal_number": "SL001"
}
```

### 9.3 Package Object (LCL / AIR)
```json
{
  "packaging_type": "CARTON",
  "quantity": 50,
  "gross_weight_kg": 500.0,
  "volume_cbm": 2.5
}
```

### 9.4 Cargo Object
```json
{
  "description": "Electronic Components",
  "hs_code": "8542.31",
  "is_dg": false,
  "dg_class": null,
  "dg_un_number": null,
  "dg_description": null,
  "weight_kg": 5000.0
}
```

`dg_description` is present when `is_dg = true`.  
⚠️ V1 migrated shipments may have `dg_classification` as a nested object instead of `is_dg` boolean — normalise on read.

### 9.5 Workflow Task Object
```json
{
  "task_id": "booking",
  "task_type": "FREIGHT_BOOKING",
  "label": "Arrange Booking",
  "status": "pending",
  "mode": "ASSIGNED",
  "assigned_to": "AF",
  "visibility": "VISIBLE",
  "due_date": "2026-03-05",
  "due_date_override": false,
  "scheduled_start": null,
  "scheduled_end": "2026-03-05",
  "actual_start": null,
  "actual_end": null,
  "completed_at": null,
  "third_party_name": null,
  "notes": null,
  "updated_by": null,
  "updated_at": null
}
```

`status` values: `pending` | `in_progress` | `completed` | `blocked`  
`mode` values: `ASSIGNED` | `TRACKED` | `IGNORED`  
`assigned_to` values: `AF` | `CUSTOMER` | `THIRD_PARTY`  
`visibility` values: `VISIBLE` | `HIDDEN`

### 9.6 Origin / Destination Object
```json
{
  "type": "PORT",
  "port_un_code": "MYPKG",
  "terminal_id": "MYPKG_W",
  "city_id": null,
  "address": null,
  "country_code": "MY",
  "label": "Port Klang (Westports)"
}
```

### 9.7 Exception Data Object
```json
{
  "flagged": false,
  "raised_at": null,
  "raised_by": null,
  "notes": null
}
```

### 9.8 Country Object
```json
{
  "country_code": "MY",
  "name": "Malaysia",
  "currency_code": "MYR",
  "tax_label": "SST",
  "tax_rate": 8.0,
  "tax_applicable": true,
  "is_active": true
}
```

---

## 10. Ground Transport

Base path: `/api/v2/ground-transport`

Unified transport order architecture. Each order has a list of **stops** (source of truth) and **legs** that are auto-derived between consecutive stops. Orders live in the shared `orders` table with `order_type = 'transport'`.

### 10.1 Vehicle Types

#### `GET /ground-transport/vehicle-types`
Auth: `require_afu`

Returns all active vehicle types ordered by `sort_order`.

**Response:**
```json
{
  "status": "OK",
  "data": [
    { "vehicle_type_id": "TRUCK_3TON", "label": "3-Ton Truck", "category": "TRUCK", "sort_order": 1 }
  ]
}
```

---

### 10.2 Create Order

#### `POST /ground-transport`
Auth: `require_afu`

Creates a ground transport order with stops inline. Legs are auto-derived.

**Request body:**
```json
{
  "transport_mode": "haulage",
  "leg_type": "last_mile",
  "parent_order_id": "AF-003873",
  "vendor_id": null,
  "cargo_description": "Electronic Components",
  "container_numbers": ["COSCU1234567"],
  "weight_kg": 5000.0,
  "volume_cbm": null,
  "vehicle_type_id": "TRUCK_3TON",
  "equipment_type": null,
  "equipment_number": null,
  "detention_mode": "direct",
  "detention_free_days": 5,
  "notes": null,
  "stops": [
    {
      "sequence": 1,
      "stop_type": "pickup",
      "address_line": "Westports Gate 3, Pulau Indah",
      "area_id": null,
      "city_id": 1,
      "lat": 2.9996,
      "lng": 101.3851,
      "scheduled_arrival": "2026-03-25",
      "notes": null
    },
    {
      "sequence": 2,
      "stop_type": "dropoff",
      "address_line": "Shah Alam Warehouse",
      "area_id": 1,
      "city_id": 1,
      "lat": 3.073050,
      "lng": 101.518200,
      "scheduled_arrival": "2026-03-25",
      "notes": null
    }
  ]
}
```

`transport_mode` values: `haulage` | `trucking`  
`leg_type` values: `first_mile` | `last_mile` | `standalone` | `distribution`  
`stop_type` values: `pickup` | `dropoff` | `waypoint`  
`detention_mode` values: `direct` | `detained`  
`parent_order_id` links to a shipment (`AF-XXXXXX`) or another order.

**Response:** `{ "status": "OK", "data": <OrderDetail> }`

---

### 10.3 List Orders

#### `GET /ground-transport`
Auth: `require_afu`  
Query params:
- `transport_mode` — `haulage` | `trucking` (also accepts legacy alias `transport_type`)
- `status` — filter by order status
- `parent_order_id` — filter by linked shipment/order (also accepts legacy alias `parent_shipment_id`)

**Response:** `{ "status": "OK", "data": [ <OrderSummary>, ... ] }`

---

### 10.4 Get Order

#### `GET /ground-transport/{order_id}`
Auth: `require_afu`

Returns order with full stops and legs.

**Response:** `{ "status": "OK", "data": <OrderDetail> }`

---

### 10.5 Update Order

#### `PATCH /ground-transport/{order_id}`
Auth: `require_afu`

Partial update. At least one field required.

**Request body:** (all optional)
```json
{
  "status": "confirmed",
  "sub_status": null,
  "vendor_id": null,
  "cargo_description": "Electronic Components",
  "container_numbers": ["COSCU1234567"],
  "weight_kg": 5000.0,
  "volume_cbm": null,
  "vehicle_type_id": "TRUCK_3TON",
  "equipment_type": null,
  "equipment_number": null,
  "detention_mode": "direct",
  "detention_free_days": 5,
  "notes": null
}
```

`status` values: `draft` | `confirmed` | `dispatched` | `in_transit` | `detained` | `completed` | `cancelled`

**Response:** `{ "status": "OK", "data": <OrderDetail> }`

---

### 10.6 Cancel Order

#### `DELETE /ground-transport/{order_id}`
Auth: `require_afu`  
Soft cancel — sets `status = 'cancelled'`.

**Response:** `{ "status": "OK", "data": <OrderSummary> }`

---

### 10.7 Stops

#### `POST /ground-transport/{order_id}/stops`
Auth: `require_afu`  
Add a stop to an existing order. Legs are auto-re-derived from all stops.

**Request body:** Single stop object (same shape as stops array item in create request).

**Response:** `{ "status": "OK", "data": { "stops": [ ... ], "legs": [ ... ] } }`

#### `PATCH /ground-transport/{order_id}/stops/{stop_id}`
Auth: `require_afu`  
Partial update on a single stop. Legs are NOT re-derived on stop update (only on add).

**Request body:** (all optional)
```json
{
  "stop_type": "dropoff",
  "address_line": "New Warehouse Address",
  "area_id": null,
  "city_id": 1,
  "lat": 3.073050,
  "lng": 101.518200,
  "scheduled_arrival": "2026-03-25",
  "actual_arrival": "2026-03-25",
  "notes": "Arrived on time"
}
```

**Response:** `{ "status": "OK", "data": { "stops": [ ... ], "legs": [ ... ] } }`

---

### 10.8 Legs

Legs are auto-derived from stops (one leg per consecutive stop pair). Never created or deleted manually.

#### `PATCH /ground-transport/{order_id}/legs/{leg_id}`
Auth: `require_afu`

**Request body:** (all optional)
```json
{
  "driver_name": "Ahmad bin Ali",
  "driver_contact": "+60 12 345 6789",
  "vehicle_plate": "BCD 1234",
  "vehicle_type_id": "TRUCK_3TON",
  "equipment_type": null,
  "equipment_number": null,
  "status": "in_transit",
  "notes": null
}
```

`leg status` values: `pending` | `in_transit` | `completed`

**Response:** `{ "status": "OK", "data": [ <LegObject>, ... ] }` — returns all legs for the order.

---

### 10.9 Shipment Scope

#### `GET /ground-transport/shipment/{shipment_id}/reconcile`
Auth: `require_afu`

Reconciles existing transport orders against a shipment's scope flags. Returns covered items and any gaps (flagged scope items with no matching order).

**Response:**
```json
{
  "status": "OK",
  "data": {
    "scope": { "last_mile_haulage": true, "last_mile_trucking": false },
    "orders": [ <OrderDetail>, ... ],
    "gaps": ["last_mile_haulage"]
  }
}
```

#### `PATCH /ground-transport/shipment/{shipment_id}/scope`
Auth: `require_afu`  
Partial merge of scope flags on a shipment. At least one field required.

**Request body:** (all optional)
```json
{
  "first_mile_haulage": false,
  "first_mile_trucking": false,
  "export_clearance": false,
  "sea_freight": true,
  "import_clearance": false,
  "last_mile_haulage": true,
  "last_mile_trucking": false
}
```

**Response:** `{ "status": "OK", "data": { ...merged scope... } }`

---

### 10.10 Geocoding

All geocode endpoints require `require_afu` and proxy to Google APIs. They return `{ "status": "OK", "data": { ... } }` with null values on failure (non-fatal).

#### `GET /ground-transport/geocode/autocomplete`
Query params: `input` (min 3 chars, required), `sessiontoken` (optional)

Up to 5 place suggestions from Google Places API (New).

**Response:** `{ "status": "OK", "data": [ { "place_id": "ChIJ...", "description": "Shah Alam, Selangor, Malaysia" } ] }`

#### `GET /ground-transport/geocode/place`
Query params: `place_id` (required), `sessiontoken` (optional)

Resolves a `place_id` to coordinates and address components.

**Response:**
```json
{
  "status": "OK",
  "data": { "lat": 3.073050, "lng": 101.518200, "formatted_address": "Shah Alam, Selangor, Malaysia", "city": "Shah Alam", "state": "Selangor", "country": "MY" }
}
```

#### `GET /ground-transport/geocode`
Query params: `address` (min 3 chars, required)

Geocodes a free-text address string via Google Maps Geocoding API. Same response shape as `/geocode/place`.

---

### 10.11 Data Objects — Ground Transport

**OrderDetail shape:**
```json
{
  "order_id": "TR-000001",
  "transport_mode": "haulage",
  "leg_type": "last_mile",
  "parent_order_id": "AF-003873",
  "vendor_id": null,
  "status": "draft",
  "sub_status": null,
  "cargo_description": "Electronic Components",
  "container_numbers": ["COSCU1234567"],
  "weight_kg": 5000.0,
  "volume_cbm": null,
  "detention_mode": "direct",
  "detention_free_days": 5,
  "notes": null,
  "created_by": "calvin@accelefreight.com",
  "created_at": "2026-03-05T10:00:00+00:00",
  "updated_at": "2026-03-05T10:00:00+00:00",
  "stops": [ <StopObject>, ... ],
  "legs": [ <LegObject>, ... ]
}
```

**StopObject shape:**
```json
{
  "stop_id": 1,
  "order_id": "TR-000001",
  "sequence": 1,
  "stop_type": "pickup",
  "address_line": "Westports Gate 3, Pulau Indah",
  "area_id": null,
  "city_id": 1,
  "lat": 2.9996,
  "lng": 101.3851,
  "scheduled_arrival": "2026-03-25",
  "actual_arrival": null,
  "notes": null
}
```

**LegObject shape:**
```json
{
  "leg_id": 1,
  "order_id": "TR-000001",
  "from_stop_id": 1,
  "to_stop_id": 2,
  "sequence": 1,
  "driver_name": null,
  "driver_contact": null,
  "vehicle_plate": null,
  "vehicle_type_id": null,
  "equipment_type": null,
  "equipment_number": null,
  "status": "pending",
  "notes": null
}
```

---

## 11. Open Items / Known Gaps

| Item | Detail | Target |
|---|---|---|
| Invoice endpoints | No dedicated endpoints — V1 reads still from Datastore | Future |
| Quotation endpoints | Not yet built for V2 | Future |
| Files base router | `/api/v2/files` stub only — upload-url returns null | Future |
| `GET /shipments/{id}/bl` | No dedicated GET — `bl_document` returned in `GET /shipments/{id}` | By design |
| Pagination standard | List responses use different cursor formats | Future |
| Envelope consistency | Some list endpoints return no envelope | Future |
| Xero webhook | Invoice sync not in V2 | Future |
| DG cargo legacy | V1 migrated `dg_classification` object vs V2 `is_dg` boolean — normalise on read | Ongoing |
| Countries — create/delete | `PATCH` only — no POST or DELETE on countries | Future |
| Geography — admin UI | No admin console yet for managing ports, cities, haulage areas via UI | Future |

---

## 12. Auth Dependency Map

| Endpoint | Auth |
|---|---|
| `GET /` | None |
| `GET /ports` | None |
| `GET /ports/{code}` | None |
| `GET /geography/ports` | `require_auth` |
| `GET /geography/ports/{code}` | `require_auth` |
| `PATCH /geography/ports/{code}` | `require_afu` |
| `GET /geography/states` | `require_auth` |
| `GET /geography/states/{code}` | `require_auth` |
| `GET /geography/cities` | `require_auth` |
| `GET /geography/cities/{city_id}` | `require_auth` |
| `POST /geography/cities` | `require_afu` |
| `PATCH /geography/cities/{city_id}` | `require_afu` |
| `GET /geography/areas` | `require_auth` |
| `GET /geography/areas/{area_id}` | `require_auth` |
| `POST /geography/areas` | `require_afu` |
| `PATCH /geography/areas/{area_id}` | `require_afu` |
| `DELETE /geography/areas/{area_id}` | `require_afu` |
| `POST /geography/ports/resolve` | `require_afu` |
| `POST /geography/ports/confirm` | `require_afu` |
| `GET /geography/countries` | `require_auth` |
| `GET /geography/countries/{code}` | `require_auth` |
| `PATCH /geography/countries/{code}` | `require_afu` |
| `GET /shipments/stats` | `require_auth` |
| `GET /shipments/search` | `require_auth` |
| `GET /shipments/` | `require_auth` |
| `GET /shipments/file-tags` | `require_auth` |
| `GET /shipments/{id}` | `require_auth` |
| `GET /shipments/{id}/status-history` | `require_auth` |
| `GET /shipments/{id}/files` | `require_auth` |
| `GET /shipments/{id}/tasks` | `require_auth` |
| `GET /shipments/{id}/route-nodes` | `require_auth` |
| `GET /shipments/{id}/files/{fid}/download` | `require_auth` |
| `POST /shipments/` | `require_afu_admin` |
| `DELETE /shipments/{id}` | `require_afu_admin` |
| `PATCH /shipments/{id}/cargo` | `require_afu_admin` |
| `PATCH /shipments/{id}/status` | `require_afu` |
| `PATCH /shipments/{id}/complete` | `require_afu` |
| `PATCH /shipments/{id}/invoiced` | `require_afu` |
| `PATCH /shipments/{id}/incoterm` | `require_afu` |
| `PATCH /shipments/{id}/port` | `require_afu` |
| `PATCH /shipments/{id}/company` | `require_afu` |
| `PATCH /shipments/{id}/booking` | `require_afu` |
| `PATCH /shipments/{id}/bl` | `require_afu` |
| `PATCH /shipments/{id}/parties` | `require_afu` |
| `PATCH /shipments/{id}/clear-parsed-diff` | `require_afu` |
| `POST /shipments/{id}/apply-booking-confirmation` | `require_afu` |
| `POST /shipments/{id}/apply-awb` | `require_afu` |
| `POST /shipments/{id}/save-document-file` | `require_afu` |
| `POST /shipments/parse-bl` | `require_afu` |
| `POST /shipments/create-from-bl` | `require_afu` |
| `PATCH /shipments/{id}/exception` | `require_auth` (AFC role-gated internally) |
| `POST /shipments/{id}/files` | `require_auth` (AFC role-gated internally) |
| `PATCH /shipments/{id}/files/{fid}` | `require_auth` (AFC role-gated internally) |
| `PATCH /shipments/{id}/tasks/{tid}` | `require_auth` (AFC role-gated internally) |
| `PUT /shipments/{id}/route-nodes` | `require_auth` (AFC role-gated internally) |
| `PATCH /shipments/{id}/route-nodes/{seq}` | `require_auth` (AFC role-gated internally) |
| `DELETE /shipments/{id}/files/{fid}` | `require_afu` |
| `GET /companies` | `require_afu` |
| `GET /companies/stats` | `require_afu` |
| `GET /companies/{id}` | `require_auth` |
| `POST /companies` | `require_afu_admin` |
| `PATCH /companies/{id}` | `require_afu` |
| `GET /users/me` | `require_auth` |
| `GET /users` | `require_afu_admin` |
| `POST /users` | `require_afu_admin` |
| `PATCH /users/{uid}` | `require_afu_admin` |
| `DELETE /users/{uid}` | `require_afu_admin` |
| `POST /users/{uid}/reset-password` | `require_afu_admin` |
| `POST /users/{uid}/send-reset-email` | `require_afu_admin` |
| `PATCH /users/{uid}/promote-to-staff` | `require_afu_admin` |
| `POST /ai/parse-document` | `require_auth` |
| `GET /ground-transport/vehicle-types` | `require_afu` |
| `POST /ground-transport` | `require_afu` |
| `GET /ground-transport` | `require_afu` |
| `GET /ground-transport/{order_id}` | `require_afu` |
| `PATCH /ground-transport/{order_id}` | `require_afu` |
| `DELETE /ground-transport/{order_id}` | `require_afu` |
| `POST /ground-transport/{order_id}/stops` | `require_afu` |
| `PATCH /ground-transport/{order_id}/stops/{stop_id}` | `require_afu` |
| `PATCH /ground-transport/{order_id}/legs/{leg_id}` | `require_afu` |
| `GET /ground-transport/shipment/{shipment_id}/reconcile` | `require_afu` |
| `PATCH /ground-transport/shipment/{shipment_id}/scope` | `require_afu` |
| `GET /ground-transport/geocode/autocomplete` | `require_afu` |
| `GET /ground-transport/geocode/place` | `require_afu` |
| `GET /ground-transport/geocode` | `require_afu` |

---

*Last updated: 05 March 2026 — Contract v1.7*

**v1.7 changes:**
- Section 2.2: Search response documented with `total` and `next_cursor` fields; envelope note removed (response is not envelope-wrapped)
- Section 2.12: `PATCH /booking` request body corrected — removed `vehicle_type_id`, `equipment_type`, `equipment_number` (not valid fields on shipment booking; those belong to transport orders only); field descriptions clarified

**v1.6 changes:**
- Section 2.12: New `PATCH /shipments/{id}/booking` endpoint documented
- Sections 2.13–2.20: Renumbered to accommodate new booking section
- Section 5.6: `haulage-areas` → `areas` — all endpoints renamed (`/geography/haulage-areas/*` → `/geography/areas/*`)
- Section 10: New Ground Transport section — orders, stops, legs, vehicle types, scope flags, reconciliation, geocoding
- Section 11: Open Items (renumbered from 10)
- Section 12: Auth Dependency Map (renumbered from 11)

**v1.5 changes:**
- Section 0.3: AFU roles updated to `AFU-ADMIN`, `AFU-STAFF`, `AFU-OPS` (reflecting actual codebase)
- Section 2.8: New `PATCH /shipments/{id}/complete` endpoint documented
- Section 2.9: `PATCH /shipments/{id}/invoiced` gate changed from `status=5001` to `completed=TRUE`
- Section 2.12: New `PATCH /shipments/{id}/incoterm` endpoint documented
- Section 2.13: New `PATCH /shipments/{id}/port` endpoint documented
- Section 2.14: New `PATCH /shipments/{id}/cargo` (DG flag) endpoint documented
- Section 2.15: `PATCH /bl` — added new form fields (`cargo_description`, `total_weight_kg`, `lcl_container_number`, `lcl_seal_number`, `origin_terminal`, `dest_terminal`, `bl_shipper_address`, `bl_consignee_address`); response now includes `new_status`
- Section 2.15: New `PATCH /shipments/{id}/clear-parsed-diff` endpoint documented
- Section 2.15: `POST /apply-booking-confirmation` — added `shipper_name` field; `new_status` now incoterm-aware (not always 3002); `save-document-file` marked deprecated for frontend use
- Section 2.15: `POST /apply-awb` — response now includes `new_status`
- Section 2.17: Task PATCH — auto status progression documented (POL ATD → Departed, POD ATA → Arrived)
- Section 2.18: Route node PATCH — auto status progression documented; response now includes `auto_status_changed` and `new_status`
- Section 4.8: New `PATCH /users/{uid}/promote-to-staff` endpoint documented
- Section 5.3: New `PATCH /geography/ports/{un_code}` (coordinate update) documented
- Section 5.8: Countries endpoints fully documented (was stub in v1.4) — list, get, patch
- Section 8: AI section completely replaced — `POST /ai/parse-document` fully documented (was stub)
- Section 9.4: Cargo object updated with `dg_description` and `weight_kg` fields
- Section 11: Auth map updated with all new endpoints
