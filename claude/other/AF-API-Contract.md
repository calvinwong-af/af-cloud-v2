# AcceleFreight — AF Server V2 API Contract
**Base URL:** `https://af-server-667020632236.asia-northeast1.run.app/api/v2` (prod) · `http://localhost:8000/api/v2` (local)  
**Auth:** Firebase ID token — `Authorization: Bearer <token>` on all protected routes  
**Version:** Contract v2.0 — 12 March 2026  
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

### 2.21 Type Details (Container & Seal Numbers)

#### `PATCH /shipments/{shipment_id}/type-details`
Auth: `require_afu`

Edits container numbers and seal numbers stored in the `type_details` JSONB. For FCL shipments, individual container and seal numbers are patched by index within the containers array. For LCL/AIR shipments, a single consolidation container number and seal number are set at the top level.

**Request body (FCL):**
```json
{
  "container_numbers": ["COSCU1234567", "COSCU7654321"],
  "seal_numbers": ["SL001", "SL002"]
}
```

Arrays are positionally mapped to the existing `type_details.containers` array. A `null` at any index is a no-op for that position — only non-null values overwrite. Arrays must not exceed the existing container count.

**Request body (LCL / AIR):**
```json
{
  "container_number": "COSCU1234567",
  "seal_number": "SL001"
}
```

For LCL, these are stored at `type_details.container_number` / `type_details.seal_number`. Empty string (`""`) clears the value.

**Response:** `{ "status": "OK", "data": { "type_details": { ... } }, "msg": "Type details updated" }`

**Errors:** `400` — array length exceeds container count. `404` — shipment not found.

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

### 5.7 Port Terminals

#### `GET /geography/port-terminals`
Auth: `require_auth` · 10-minute cache  
Returns all active port terminals across all ports.

**Response:**
```json
{
  "status": "OK",
  "data": [
    {
      "terminal_id": "MYPKG_W",
      "name": "Westports",
      "label": "Westports",
      "port_un_code": "MYPKG"
    },
    {
      "terminal_id": "MYPKG_N",
      "name": "Northport",
      "label": "Northport",
      "port_un_code": "MYPKG"
    }
  ]
}
```

#### `GET /geography/port-terminals/{terminal_id}`
Auth: `require_auth`  
Returns a single terminal by `terminal_id`.

**Response:**
```json
{
  "status": "OK",
  "data": {
    "terminal_id": "MYPKG_W",
    "name": "Westports",
    "label": "Westports",
    "port_un_code": "MYPKG"
  }
}
```

**Errors:** `404` — terminal not found.

⚠️ Terminal admin CRUD (create/update/delete) is not yet exposed via API. Terminals are currently managed directly in the database or via migration scripts.

---

### 5.8 Port Resolution (AI-Assisted)

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

### 5.9 Countries

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

## 13. Pricing

Base path: `/api/v2/pricing`

The pricing module has six sub-routers: `fcl`, `lcl`, `haulage`, `air`, `local-charges`, `customs`, and `port-transport`. All pricing endpoints require AFU authentication.

**Common concepts across all pricing sub-modules:**
- A **rate card** defines the lane or service scope (port pair, area, airline, etc.) and is the container for all rate history on that lane.
- A **rate** is a point-in-time price entry on a rate card, identified by `effective_from` (and optionally `effective_to`). `supplier_id = null` is the price-reference rate (what AcceleFreight charges customers). Non-null `supplier_id` entries are cost rates from specific carriers/suppliers.
- Rate history is append-only — rates are never overwritten, only added. Deleting a rate is permitted (e.g. data entry errors).
- `rate_status` values: `PUBLISHED` | `ON_REQUEST` | `DRAFT` | `REJECTED` (FCL/LCL use `PUBLISHED` | `ON_REQUEST` only; haulage and air support the full set)
- DRAFT rates can be promoted via a dedicated `POST /rates/{id}/publish` endpoint and rejected via `POST /rates/{id}/reject`.
- Time series responses (on list endpoints) cover a 12-month window: 9 past months, current month, and 2 forward months. Values carry forward from the most recent active row for historical and current months; future months only show a value if a rate explicitly starts in that month.

**Shared pricing endpoints:**

#### `GET /pricing/dashboard-summary`
Auth: `require_afu`  
Query params: `country_code` (optional)

Returns alert and health metrics for FCL, LCL, local-charges, customs, and port-transport modules.

**Response:**
```json
{
  "status": "OK",
  "data": {
    "fcl": {
      "total_cards": 408,
      "last_updated": "2026-03-01",
      "expiring_soon": 3,
      "cost_exceeds_price": 0,
      "no_active_cost": 2,
      "no_list_price": 1,
      "price_review_needed": 4
    },
    "lcl": { ... },
    "local-charges": { ... },
    "customs": { ... },
    "port-transport": { ... }
  }
}
```

`expiring_soon` — cards with no rate for next month and within 7 days of month-end.  
`cost_exceeds_price` — current cost > current list price.  
`no_active_cost` — list price present but no current supplier cost row.  
`no_list_price` — supplier cost present but no current list price row.  
`price_review_needed` — cost updated more recently than list price.

#### `GET /pricing/countries`
Auth: `require_afu`  
Returns distinct country codes present across all active FCL and LCL rate cards.

**Response:** `{ "status": "OK", "data": [ { "country_code": "MY", "country_name": "Malaysia" }, ... ] }`

---

### 13.1 FCL Rate Cards

Base path: `/api/v2/pricing/fcl`

**FCL Rate Card Key format:** `ORIGIN:DEST:DG:SIZE:TYPE`  
Example: `VNSGN:MYPKG:GEN:40HC:DRY`

#### `GET /pricing/fcl/rate-cards`
Auth: `require_afu`  
Query params (all optional): `origin_port_code`, `destination_port_code`, `dg_class_code`, `container_size`, `container_type`, `is_active` (default `true`)

Returns matching rate cards. Each card includes `latest_price_ref` — the most recent price-reference rate (where `supplier_id IS NULL`) attached inline.

**Response:**
```json
{
  "status": "OK",
  "data": [
    {
      "id": 1,
      "rate_card_key": "VNSGN:MYPKG:GEN:40HC:DRY",
      "origin_port_code": "VNSGN",
      "destination_port_code": "MYPKG",
      "dg_class_code": "GEN",
      "container_size": "40HC",
      "container_type": "DRY",
      "code": "VN-MY-40HC",
      "description": "Vietnam to Port Klang 40HC Dry",
      "terminal_id": "MYPKG_W",
      "is_active": true,
      "created_at": "2024-01-01 00:00:00",
      "updated_at": null,
      "latest_price_ref": {
        "list_price": 850.0,
        "currency": "USD",
        "effective_from": "2026-03-01"
      }
    }
  ]
}
```

`latest_price_ref` is `null` if no price-reference rate exists for the card.

#### `GET /pricing/fcl/rate-cards/{card_id}`
Auth: `require_afu`  
Returns full rate card detail including all rates grouped by supplier.

**Response:**
```json
{
  "status": "OK",
  "data": {
    "id": 1,
    "rate_card_key": "VNSGN:MYPKG:GEN:40HC:DRY",
    "origin_port_code": "VNSGN",
    "destination_port_code": "MYPKG",
    "dg_class_code": "GEN",
    "container_size": "40HC",
    "container_type": "DRY",
    "code": "VN-MY-40HC",
    "description": "Vietnam to Port Klang 40HC Dry",
    "terminal_id": "MYPKG_W",
    "is_active": true,
    "created_at": "2024-01-01 00:00:00",
    "updated_at": null,
    "rates_by_supplier": {
      "null": [
        {
          "id": 10,
          "rate_card_id": 1,
          "supplier_id": null,
          "effective_from": "2026-03-01",
          "rate_status": "PUBLISHED",
          "currency": "USD",
          "uom": "CONTAINER",
          "list_price": 850.0,
          "min_list_price": null,
          "cost": 700.0,
          "min_cost": null,
          "roundup_qty": 0,
          "lss": 0.0,
          "baf": 0.0,
          "ecrs": 0.0,
          "psc": 0.0,
          "created_at": "2026-03-01 00:00:00",
          "updated_at": null
        }
      ],
      "COSCO": [ ... ]
    }
  }
}
```

`rates_by_supplier` keys are `supplier_id` strings (or `"null"` for the price-reference). Each key maps to an array of rates ordered `effective_from DESC`.

#### `POST /pricing/fcl/rate-cards`
Auth: `require_afu_admin`

**Request body:**
```json
{
  "origin_port_code": "VNSGN",
  "destination_port_code": "MYPKG",
  "dg_class_code": "GEN",
  "container_size": "40HC",
  "container_type": "DRY",
  "code": "VN-MY-40HC",
  "description": "Vietnam to Port Klang 40HC Dry",
  "terminal_id": "MYPKG_W"
}
```

`terminal_id` is optional. If provided, it must belong to the destination port (validated server-side).

**Response:** `{ "status": "OK", "data": { "id": 1, "rate_card_key": "VNSGN:MYPKG:GEN:40HC:DRY", ... } }`

**Errors:** `409` — rate card key already exists. `400` — origin equals destination, or `terminal_id` belongs to wrong port.

#### `PATCH /pricing/fcl/rate-cards/{card_id}`
Auth: `require_afu_admin`  
All fields optional.

**Request body:**
```json
{
  "code": "VN-MY-40HC-V2",
  "description": "Updated description",
  "is_active": false,
  "terminal_id": "MYPKG_N"
}
```

⚠️ There is no `DELETE /pricing/fcl/rate-cards/{id}` endpoint. Deactivate by setting `is_active: false`.

**Response:** `{ "status": "OK", "msg": "Rate card updated" }`

---

### 13.2 FCL Rates

#### `GET /pricing/fcl/rate-cards/{card_id}/rates`
Auth: `require_afu`  
Query params: `supplier_id` (optional) — pass empty string `""` to get only price-reference rates (`supplier_id IS NULL`)

**Response:** `{ "status": "OK", "data": [ <FCLRateObject>, ... ] }`

Rates ordered `effective_from DESC`.

#### `POST /pricing/fcl/rate-cards/{card_id}/rates`
Auth: `require_afu_admin`

**Request body:**
```json
{
  "supplier_id": null,
  "effective_from": "2026-04-01",
  "rate_status": "PUBLISHED",
  "currency": "USD",
  "uom": "CONTAINER",
  "list_price": 900.0,
  "min_list_price": null,
  "cost": 720.0,
  "min_cost": null,
  "roundup_qty": 0,
  "lss": 0,
  "baf": 0,
  "ecrs": 0,
  "psc": 0
}
```

`supplier_id` is optional (null = price-reference rate). `uom` default is `CONTAINER`. `rate_status` default is `PUBLISHED`.

**Response:** `{ "status": "OK", "data": { "id": 11, "rate_card_id": 1, "created_at": "..." } }`

#### `PATCH /pricing/fcl/rates/{rate_id}`
Auth: `require_afu_admin`  
All fields optional.

**Request body:** (same shape as POST, all optional)

**Response:** `{ "status": "OK", "msg": "Rate updated" }`

#### `DELETE /pricing/fcl/rates/{rate_id}`
Auth: `require_afu_admin`  
Hard delete. Intended for correcting data entry errors only.

**Response:** `{ "status": "OK", "msg": "Rate deleted" }`

---

### 13.3 LCL Rate Cards

Base path: `/api/v2/pricing/lcl`

**LCL Rate Card Key format:** `ORIGIN:DEST:DG`  
Example: `VNSGN:MYPKG:GEN`

LCL rate cards follow the same pattern as FCL but without `container_size` and `container_type`.

#### `GET /pricing/lcl/rate-cards`
Auth: `require_afu`  
Query params (all optional): `origin_port_code`, `destination_port_code`, `dg_class_code`, `is_active` (default `true`)

**Response shape:** Same as FCL rate card list, without `container_size` and `container_type` fields.

#### `GET /pricing/lcl/rate-cards/{card_id}`
Auth: `require_afu`  
Same as FCL — returns card with `rates_by_supplier`.

#### `POST /pricing/lcl/rate-cards`
Auth: `require_afu_admin`

**Request body:**
```json
{
  "origin_port_code": "VNSGN",
  "destination_port_code": "MYPKG",
  "dg_class_code": "GEN",
  "code": "VN-MY-LCL",
  "description": "Vietnam to Port Klang LCL",
  "terminal_id": "MYPKG_W"
}
```

**Errors:** `409` — rate card key already exists.

#### `PATCH /pricing/lcl/rate-cards/{card_id}`
Auth: `require_afu_admin`  
Same updatable fields as FCL: `code`, `description`, `is_active`, `terminal_id`.

---

### 13.4 LCL Rates

Identical structure to FCL rates. Default `uom` is `W/M` instead of `CONTAINER`.

#### `GET /pricing/lcl/rate-cards/{card_id}/rates`
Auth: `require_afu`

#### `POST /pricing/lcl/rate-cards/{card_id}/rates`
Auth: `require_afu_admin`  
Same body as FCL rate POST with `uom` defaulting to `W/M`.

#### `PATCH /pricing/lcl/rates/{rate_id}`
Auth: `require_afu_admin`

#### `DELETE /pricing/lcl/rates/{rate_id}`
Auth: `require_afu_admin`

---

### 13.5 Data Objects — Pricing

**FCLRateCard shape:**
```json
{
  "id": 1,
  "rate_card_key": "VNSGN:MYPKG:GEN:40HC:DRY",
  "origin_port_code": "VNSGN",
  "destination_port_code": "MYPKG",
  "dg_class_code": "GEN",
  "container_size": "40HC",
  "container_type": "DRY",
  "code": "VN-MY-40HC",
  "description": "Vietnam to Port Klang 40HC Dry",
  "terminal_id": "MYPKG_W",
  "is_active": true,
  "created_at": "2024-01-01 00:00:00",
  "updated_at": null
}
```

**LCLRateCard shape:** Same as above, without `container_size` and `container_type`.

**Rate shape (FCL and LCL):**
```json
{
  "id": 10,
  "rate_card_id": 1,
  "supplier_id": null,
  "effective_from": "2026-03-01",
  "rate_status": "PUBLISHED",
  "currency": "USD",
  "uom": "CONTAINER",
  "list_price": 850.0,
  "min_list_price": null,
  "cost": 700.0,
  "min_cost": null,
  "roundup_qty": 0,
  "lss": 0.0,
  "baf": 0.0,
  "ecrs": 0.0,
  "psc": 0.0,
  "created_at": "2026-03-01 00:00:00",
  "updated_at": null
}
```

`supplier_id = null` — price-reference rate (what AcceleFreight charges customers).  
`supplier_id = "COSCO"` — cost rate from a specific carrier/supplier.  
`lss`, `baf`, `ecrs`, `psc` — surcharge fields; default `0`.  
`roundup_qty` — container rounding unit; default `0`.  
`uom` for LCL defaults to `W/M` (weight/measurement). FCL defaults to `CONTAINER`.

---

### 13.6 Haulage

Base path: `/api/v2/pricing/haulage`

Haulage covers port-to-area container transport. Rate cards are defined by port + optional terminal + area + container size. The module includes depot gate fees and supplier rebates as separate entities.

**Haulage Rate Card Key format:** `PORT:AREA_CODE:SIZE` (no terminal) or `PORT:TERMINAL:AREA_CODE:SIZE` (with terminal)  
Example: `MYPKG:KL035:40HC` or `MYPKG:MYPKG_W:KL035:40HC`

**Container sizes:** `20` | `40` | `40HC` | `wildcard`

#### Reference data

##### `GET /pricing/haulage/areas`
Auth: `require_afu`  
Query params: `port_un_code` (optional, filters to areas with active rate cards for that port), `is_active` (default `true`)

**Response:** `{ "status": "OK", "data": [ { "area_id": 1, "area_code": "KL035", "area_name": "Klang / Shah Alam", "state_code": "MY-SGR", "state_name": "Selangor" }, ... ] }`

##### `GET /pricing/haulage/ports`
Auth: `require_afu`  
Query params: `country_code` (optional), `is_active` (default `true`)

Returns distinct port codes with active haulage rate cards.

**Response:** `{ "status": "OK", "data": ["MYPKG", ...] }`

##### `GET /pricing/haulage/container-sizes`
Auth: `require_afu`

**Response:** `{ "status": "OK", "data": [ { "container_size": "20", "label": "20ft" }, ... ] }`

---

#### Haulage Rate Cards

##### `GET /pricing/haulage/rate-cards`
Auth: `require_afu`  
Query params (all optional): `port_un_code`, `terminal_id`, `area_id`, `container_size`, `country_code`, `is_active` (default `true`), `alerts_only` (default `false`)

Returns matching rate cards with: `latest_price_ref` (most recent `supplier_id IS NULL` rate with surcharge totals), `pending_draft_count`, `time_series` (12-month), `latest_list_price_from`, `latest_cost_from`. Joined with area name, area code, state name, and terminal name.

**Response:**
```json
{
  "status": "OK",
  "data": [
    {
      "id": 1,
      "rate_card_key": "MYPKG:KL035:40HC",
      "port_un_code": "MYPKG",
      "terminal_id": null,
      "area_id": 1,
      "area_name": "Klang / Shah Alam",
      "area_code": "KL035",
      "state_name": "Selangor",
      "terminal_name": null,
      "container_size": "40HC",
      "include_depot_gate_fee": false,
      "side_loader_available": true,
      "is_active": true,
      "created_at": "2024-01-01 00:00:00",
      "updated_at": null,
      "latest_price_ref": {
        "list_price": 450.0,
        "currency": "MYR",
        "effective_from": "2026-03-01",
        "list_surcharge_total": 0.0,
        "total_list_price": 450.0
      },
      "pending_draft_count": 0,
      "latest_list_price_from": "2026-03-01",
      "latest_cost_from": "2026-03-01",
      "time_series": [
        {
          "month_key": "2026-03",
          "list_price": 450.0,
          "cost": 380.0,
          "currency": "MYR",
          "rate_status": "PUBLISHED",
          "list_surcharge_total": 0.0,
          "cost_surcharge_total": 0.0,
          "total_list_price": 450.0,
          "total_cost": 380.0,
          "surcharge_total": 0.0,
          "has_surcharges": false
        }
      ]
    }
  ]
}
```

`alerts_only: true` — filters to cards with any of: cost > list price, no active cost, no list price, or cost newer than list price.

##### `GET /pricing/haulage/rate-cards/{card_id}`
Auth: `require_afu`  
Returns full card with `rates_by_supplier` map (keyed by `supplier_id` string or `null`), `latest_list_price_from`, `latest_cost_from`, area and terminal metadata. Rate window: Jan 2024 onwards + one seed row per supplier for pre-2024 carry-forward.

##### `POST /pricing/haulage/rate-cards`
Auth: `require_afu_admin`

**Request body:**
```json
{
  "port_un_code": "MYPKG",
  "terminal_id": null,
  "area_id": 1,
  "container_size": "40HC",
  "include_depot_gate_fee": false,
  "side_loader_available": true
}
```

**Errors:** `409` — rate card key already exists. `400` — invalid `container_size` or `area_id` not found.

**Response:** `{ "status": "OK", "data": { "id": 1, "rate_card_key": "MYPKG:KL035:40HC", ... } }`

##### `PATCH /pricing/haulage/rate-cards/{card_id}`
Auth: `require_afu_admin`  
Updatable: `include_depot_gate_fee`, `side_loader_available`, `is_active`.

⚠️ No DELETE endpoint. Deactivate via `is_active: false`.

---

#### Haulage Rates

##### `GET /pricing/haulage/rate-cards/{card_id}/rates`
Auth: `require_afu`  
Query params: `supplier_id` (optional — pass `""` for price-reference only)

##### `POST /pricing/haulage/rate-cards/{card_id}/rates`
Auth: `require_afu_admin`

**Request body:**
```json
{
  "supplier_id": null,
  "effective_from": "2026-04-01",
  "effective_to": null,
  "rate_status": "PUBLISHED",
  "currency": "MYR",
  "uom": "CONTAINER",
  "list_price": 480.0,
  "cost": null,
  "min_list_price": null,
  "min_cost": null,
  "surcharges": null,
  "side_loader_surcharge": null,
  "roundup_qty": 0,
  "close_previous": false
}
```

`close_previous: true` — sets `effective_to = effective_from - 1 day` on the most recent open-ended row for the same card and supplier before inserting the new row.  
`side_loader_surcharge` — additional charge when side-loader equipment is used (only meaningful if `side_loader_available = true` on the rate card).  
`surcharges` — JSON array of `{ "code": "HA-FAF", "label": "Fuel Adjustment", "amount": 20.0 }` objects.

##### `PATCH /pricing/haulage/rates/{rate_id}`
Auth: `require_afu_admin`  
All fields optional. Same shape as POST. `effective_to` can be set to `null` to re-open a closed row.

##### `DELETE /pricing/haulage/rates/{rate_id}`
Auth: `require_afu_admin`  
Hard delete.

##### `POST /pricing/haulage/rates/{rate_id}/publish`
Auth: `require_afu_admin`  
Promotes a `DRAFT` rate to `PUBLISHED`. Errors if not in DRAFT status.

##### `POST /pricing/haulage/rates/{rate_id}/reject`
Auth: `require_afu_admin`  
Rejects a `DRAFT` rate. Errors if not in DRAFT status.

---

#### Depot Gate Fees

Depot gate fees are shared at port + optional terminal level. All rate cards for the same port/terminal reference a single shared fee record.

##### `GET /pricing/haulage/depot-gate-fees`
Auth: `require_afu`  
Query params: `port_un_code` (required), `terminal_id` (optional)

Returns all fee history for a port/terminal, ordered `terminal_id NULLS LAST, effective_from DESC`.

**Response:** `{ "status": "OK", "data": [ <DepotGateFeeObject>, ... ] }`

##### `GET /pricing/haulage/depot-gate-fees/active`
Auth: `require_afu`  
Query params: `port_un_code` (required), `terminal_id` (optional)

Returns the single currently active fee row (status `PUBLISHED`, `effective_from <= today`, `effective_to IS NULL OR >= today`).

**Response:** `{ "status": "OK", "data": <DepotGateFeeObject> | null }`

##### `POST /pricing/haulage/depot-gate-fees`
Auth: `require_afu_admin`

**Request body:**
```json
{
  "port_un_code": "MYPKG",
  "terminal_id": "MYPKG_W",
  "effective_from": "2026-04-01",
  "effective_to": null,
  "rate_status": "PUBLISHED",
  "currency": "MYR",
  "fee_amount": 85.0
}
```

**Errors:** `409` — duplicate port/terminal/date combination.

##### `PATCH /pricing/haulage/depot-gate-fees/{fee_id}`
Auth: `require_afu_admin`

**Request body:** (all optional) `{ "effective_from", "effective_to", "rate_status", "currency", "fee_amount" }`

##### `DELETE /pricing/haulage/depot-gate-fees/{fee_id}`
Auth: `require_afu_admin`  
Hard delete.

**DepotGateFeeObject shape:**
```json
{
  "id": 1,
  "port_un_code": "MYPKG",
  "terminal_id": "MYPKG_W",
  "effective_from": "2026-04-01",
  "effective_to": null,
  "rate_status": "PUBLISHED",
  "currency": "MYR",
  "fee_amount": 85.0,
  "created_at": "2026-03-01 00:00:00",
  "updated_at": null
}
```

---

#### Supplier Rebates

Supplier rebates are percentage-based cost reductions (applied on the cost side only), varying by supplier, port, and container size. `container_size` includes side-loader variants.

**Valid container sizes for rebates:** `20` | `40` | `40HC` | `side_loader_20` | `side_loader_40` | `side_loader_40HC`

##### `GET /pricing/haulage/supplier-rebates`
Auth: `require_afu`  
Query params: `supplier_id` (required)

**Response:** `{ "status": "OK", "data": [ <SupplierRebateObject>, ... ] }`

##### `POST /pricing/haulage/supplier-rebates`
Auth: `require_afu`

**Request body:**
```json
{
  "supplier_id": "WESTPORTS-HQ",
  "port_un_code": "MYPKG",
  "container_size": "40HC",
  "effective_from": "2026-04-01",
  "effective_to": null,
  "rate_status": "PUBLISHED",
  "rebate_percent": 0.05
}
```

`rebate_percent` is stored as a decimal (e.g. `0.05` = 5%). Uniqueness is enforced on `(supplier_id, port_un_code, container_size, effective_from)`.

##### `PATCH /pricing/haulage/supplier-rebates/{rebate_id}`
Auth: `require_afu`  
Updatable: `effective_to`, `rate_status`, `rebate_percent`.

##### `DELETE /pricing/haulage/supplier-rebates/{rebate_id}`
Auth: `require_afu`

**SupplierRebateObject shape:**
```json
{
  "id": 1,
  "supplier_id": "WESTPORTS-HQ",
  "port_un_code": "MYPKG",
  "container_size": "40HC",
  "effective_from": "2026-04-01",
  "effective_to": null,
  "rate_status": "PUBLISHED",
  "rebate_percent": 0.05,
  "created_at": "2026-03-01 00:00:00",
  "updated_at": null
}
```

---

#### FAF Rates (Fuel Adjustment Factor)

FAF rates are supplier-level, covering multiple ports per entry via a `port_rates` JSON array. They are separate from the per-rate-card `surcharges` array.

##### `GET /pricing/haulage/faf-rates`
Auth: `require_afu`  
Query params: `supplier_id` (required)

##### `POST /pricing/haulage/faf-rates`
Auth: `require_afu`

**Request body:**
```json
{
  "supplier_id": "WESTPORTS-HQ",
  "effective_from": "2026-04-01",
  "effective_to": null,
  "rate_status": "DRAFT",
  "port_rates": [
    { "port_un_code": "MYPKG", "amount": 20.0, "currency": "MYR" }
  ]
}
```

Uniqueness enforced on `(supplier_id, effective_from)`. Default `rate_status` is `DRAFT`.

##### `PATCH /pricing/haulage/faf-rates/{faf_id}`
Auth: `require_afu`  
Updatable: `effective_to`, `rate_status`, `port_rates`.

##### `DELETE /pricing/haulage/faf-rates/{faf_id}`
Auth: `require_afu`

---

### 13.7 Air Freight

Base path: `/api/v2/pricing/air`

Air freight uses a two-tier rate card structure:
- **Supplier rate cards** (`air_freight_rate_cards`) — keyed by `ORIGIN:DEST:DG:AIRLINE`. Contain supplier cost rows with weight-breakpoint pricing.
- **List price cards** (`air_list_price_rate_cards`) — keyed by `ORIGIN:DEST:DG` (no airline dimension). Contain the customer-facing list price rows. One list price card covers all airlines on the same O/D+DG lane.

Both tables use `effective_to` for date-range validity (open-ended = `NULL`).

**Weight breakpoints:** `l45` (<45kg) | `p45` (≥45kg) | `p100` (≥100kg) | `p250` (≥250kg) | `p300` (≥300kg) | `p500` (≥500kg) | `p1000` (≥1000kg)  
Each breakpoint has separate `_list_price` and `_cost` columns. `min_list_price` / `min_cost` set a minimum charge floor.

**rate_status values (air):** `PUBLISHED` | `ON_REQUEST` | `DRAFT` | `REJECTED`

---

#### Reference data

##### `GET /pricing/air/origins`
Auth: `require_afu`  
Query params: `country_code` (optional), `is_active` (default `true`)

Returns distinct origin port codes with active air rate cards.

**Response:** `{ "status": "OK", "data": ["VNSGN", "CNSHA", ...] }`

##### `GET /pricing/air/airlines`
Auth: `require_afu`  
Query params: `origin_port_code` (optional), `is_active` (default `true`)

Returns distinct airline codes with active rate cards.

**Response:** `{ "status": "OK", "data": ["MH", "AK", ...] }`

---

#### Air Supplier Rate Cards

##### `GET /pricing/air/rate-cards`
Auth: `require_afu`  
Query params (all optional): `origin_port_code`, `destination_port_code`, `airline_code`, `dg_class_code`, `country_code`, `is_active` (default `true`), `alerts_only` (default `false`)

Returns matching supplier rate cards. Each card includes:
- `latest_price_ref` — most recent published entry from the matching list price card (`l45_list_price`, `currency`, `effective_from`)
- `pending_draft_count` — count of DRAFT rows on this card
- `latest_cost_from` / `latest_list_price_from` — most recent effective dates
- `latest_cost_supplier_id` — `supplier_id` of the supplier with the lowest current `p100_cost` across all airlines on this O/D lane
- `time_series` — 12-month array (9 past + current + 2 forward)

**Response:**
```json
{
  "status": "OK",
  "data": [
    {
      "id": 1,
      "rate_card_key": "VNSGN:MYPKG:NON-DG:MH",
      "origin_port_code": "VNSGN",
      "destination_port_code": "MYPKG",
      "dg_class_code": "NON-DG",
      "airline_code": "MH",
      "code": "FR-AIR",
      "description": "",
      "is_active": true,
      "latest_price_ref": { "l45_list_price": 14.0, "currency": "MYR", "effective_from": "2026-03-01" },
      "pending_draft_count": 0,
      "latest_cost_from": "2026-03-01",
      "latest_list_price_from": "2026-03-01",
      "latest_cost_supplier_id": "MH-CARGO",
      "time_series": [ ... ]
    }
  ]
}
```

`alerts_only: true` — filters to cards where cost > list price, no list price, no active cost, or cost newer than list price, evaluated cross-table (supplier rates vs list price cards).

**time_series entry shape:**
```json
{
  "month_key": "2026-03",
  "l45_list_price": 12.5,
  "l45_cost": 9.8,
  "p100_list_price": 9.0,
  "p100_cost": 7.2,
  "currency": "MYR",
  "rate_status": "PUBLISHED",
  "list_surcharge_total": 0.5,
  "cost_surcharge_total": 0.5,
  "has_surcharges": true
}
```

##### `GET /pricing/air/rate-cards/{card_id}`
Auth: `require_afu`  
Returns full card with:
- `rates_by_supplier` — map of `supplier_id` (non-null only) → rate arrays. Rate window: Jan 2024 onwards + seed row per supplier for pre-2024 carry-forward.
- `list_price_card_id` — ID of the matching list price card (`null` if not yet created)
- `list_price_rates` — flat array of list price rate rows from `air_list_price_rates`, same window logic
- `latest_cost_from` / `latest_list_price_from`

⚠️ `rates_by_supplier` contains **only supplier cost rows** (no `null` key). List price data is exclusively in `list_price_rates` from the separate `air_list_price_rate_cards` table.

##### `POST /pricing/air/rate-cards`
Auth: `require_afu_admin`

**Request body:**
```json
{
  "origin_port_code": "VNSGN",
  "destination_port_code": "MYPKG",
  "dg_class_code": "NON-DG",
  "airline_code": "MH",
  "code": "FR-AIR",
  "description": ""
}
```

**Air rate card key format:** `ORIGIN:DEST:DG:AIRLINE`  
**Errors:** `409` — rate card key already exists.

##### `PATCH /pricing/air/rate-cards/{card_id}`
Auth: `require_afu_admin`  
Updatable: `code`, `description`, `is_active`.

---

#### Air Supplier Rates

##### `GET /pricing/air/rate-cards/{card_id}/rates`
Auth: `require_afu`  
Query params: `supplier_id` (optional)

##### `POST /pricing/air/rate-cards/{card_id}/rates`
Auth: `require_afu_admin`

**Request body:**
```json
{
  "supplier_id": "MH-CARGO",
  "effective_from": "2026-04-01",
  "effective_to": null,
  "rate_status": "PUBLISHED",
  "currency": "MYR",
  "l45_list_price": null,
  "p45_list_price": null,
  "p100_list_price": null,
  "p250_list_price": null,
  "p300_list_price": null,
  "p500_list_price": null,
  "p1000_list_price": null,
  "min_list_price": null,
  "l45_cost": 12.5,
  "p45_cost": 10.0,
  "p100_cost": 8.5,
  "p250_cost": 7.5,
  "p300_cost": 7.0,
  "p500_cost": 6.5,
  "p1000_cost": 6.0,
  "min_cost": 150.0,
  "surcharges": [
    { "code": "FSC", "label": "Fuel Surcharge", "amount": 0.5 }
  ]
}
```

`surcharges` — array of per-kg surcharge objects. Amounts are added to the base rate per kg to compute total charge.  
`effective_to` can be set to close a rate explicitly.

**Response:** `{ "status": "OK", "data": { "id": 101, "rate_card_id": 1, "created_at": "..." } }`

##### `PATCH /pricing/air/rates/{rate_id}`
Auth: `require_afu_admin`  
All fields optional. `effective_to` and `surcharges` require explicit presence in request body to be updated.

##### `DELETE /pricing/air/rates/{rate_id}`
Auth: `require_afu_admin`  
Hard delete.

##### `POST /pricing/air/rates/{rate_id}/publish`
Auth: `require_afu_admin`  
Promotes DRAFT → PUBLISHED.

##### `POST /pricing/air/rates/{rate_id}/reject`
Auth: `require_afu_admin`  
Rejects DRAFT rate.

---

#### Air List Price Cards

List price cards exist at the O/D+DG level (no airline dimension). They hold the customer-facing breakpoint rates for the entire lane, regardless of which airline is used.

**List price card key format:** `ORIGIN:DEST:DG`

##### `GET /pricing/air/list-price-cards`
Auth: `require_afu`  
Query params (all optional): `origin_port_code`, `destination_port_code`, `dg_class_code`, `is_active` (default `true`)

**Response:**
```json
{
  "status": "OK",
  "data": [
    {
      "id": 10,
      "rate_card_key": "VNSGN:MYPKG:NON-DG",
      "origin_port_code": "VNSGN",
      "destination_port_code": "MYPKG",
      "dg_class_code": "NON-DG",
      "code": "FR-AIR",
      "description": "",
      "is_active": true,
      "created_at": "2024-01-01 00:00:00",
      "updated_at": null
    }
  ]
}
```

##### `POST /pricing/air/list-price-cards`
Auth: `require_afu_admin`

**Request body:**
```json
{
  "origin_port_code": "VNSGN",
  "destination_port_code": "MYPKG",
  "dg_class_code": "NON-DG",
  "code": "FR-AIR",
  "description": ""
}
```

**Errors:** `409` — list price card key already exists.

⚠️ List price cards can also be **auto-created** by the frontend when saving a list price rate and no matching card exists yet. The `POST /pricing/air/rate-cards/{card_id}/rates` save flow in the UI triggers `createAirListPriceCardAction` before inserting the rate if `list_price_card_id` is `null` on the parent supplier rate card.

##### `PATCH /pricing/air/list-price-cards/{card_id}`
Auth: `require_afu_admin`  
Updatable: `code`, `description`, `is_active`.

---

#### Air List Price Rates

##### `GET /pricing/air/list-price-cards/{card_id}/rates`
Auth: `require_afu`  
Returns all list price rates for a card, ordered `effective_from DESC`.

##### `POST /pricing/air/list-price-cards/{card_id}/rates`
Auth: `require_afu_admin`

**Request body:**
```json
{
  "effective_from": "2026-04-01",
  "effective_to": null,
  "rate_status": "PUBLISHED",
  "currency": "MYR",
  "l45_list_price": 14.0,
  "p45_list_price": 12.0,
  "p100_list_price": 10.0,
  "p250_list_price": 9.0,
  "p300_list_price": 8.5,
  "p500_list_price": 8.0,
  "p1000_list_price": 7.5,
  "min_list_price": 180.0,
  "surcharges": null
}
```

No `supplier_id` on list price rates — they are always price-reference.

##### `PATCH /pricing/air/list-price-rates/{rate_id}`
Auth: `require_afu_admin`

##### `DELETE /pricing/air/list-price-rates/{rate_id}`
Auth: `require_afu_admin`  
Hard delete.

##### `POST /pricing/air/list-price-rates/{rate_id}/publish`
Auth: `require_afu_admin`  
Promotes DRAFT → PUBLISHED.

---

#### Air Resolve (Quotation Engine Entry Point)

##### `POST /pricing/air/rate-cards/{card_id}/resolve`
Auth: `require_afu`

Calculates the total charge for a given chargeable weight against a specific supplier (or list price if `supplier_id` is null).

**Request body:**
```json
{
  "chargeable_weight": 125.5,
  "supplier_id": "MH-CARGO",
  "reference_date": "2026-03-15"
}
```

`reference_date` is optional (defaults to today). `supplier_id` null — resolves against list price rates.

**Response:**
```json
{
  "status": "OK",
  "data": {
    "rate_id": 101,
    "rate_card_id": 1,
    "supplier_id": "MH-CARGO",
    "chargeable_weight": 125.5,
    "reference_date": "2026-03-15",
    "currency": "MYR",
    "tier_applied": "p100",
    "tier_rate": 8.5,
    "min_rate": 150.0,
    "min_applied": false,
    "surcharge_total_per_kg": 0.5,
    "surcharge_amount": 62.75,
    "surcharges": [ { "code": "FSC", "label": "Fuel Surcharge", "amount": 0.5 } ],
    "base_charge": 1066.75,
    "total_charge": 1129.5
  }
}
```

**Tier selection logic:**
- `l45`: weight < 45kg
- `p45`: ≥45kg
- `p100`: ≥100kg
- `p250`: ≥250kg
- `p300`: ≥300kg
- `p500`: ≥500kg
- `p1000`: ≥1000kg

**Charge calculation:**
- `base_charge = max(weight × tier_rate, min_rate)` — if min_rate set
- `surcharge_amount = weight × surcharge_total_per_kg`
- `total_charge = base_charge + surcharge_amount`

⚠️ Surcharge applies on actual weight even when the min charge floor is triggered.

**Errors:** `404` — no active rate found for the given supplier/date. `400` — `chargeable_weight` must be > 0.

---

### 13.8 Data Objects — Haulage

**HaulageRateCard shape:**
```json
{
  "id": 1,
  "rate_card_key": "MYPKG:KL035:40HC",
  "port_un_code": "MYPKG",
  "terminal_id": null,
  "area_id": 1,
  "area_name": "Klang / Shah Alam",
  "area_code": "KL035",
  "state_name": "Selangor",
  "terminal_name": null,
  "container_size": "40HC",
  "include_depot_gate_fee": false,
  "side_loader_available": true,
  "is_active": true,
  "created_at": "2024-01-01 00:00:00",
  "updated_at": null
}
```

**HaulageRate shape:**
```json
{
  "id": 1,
  "rate_card_id": 1,
  "supplier_id": null,
  "effective_from": "2026-03-01",
  "effective_to": null,
  "rate_status": "PUBLISHED",
  "currency": "MYR",
  "uom": "CONTAINER",
  "list_price": 450.0,
  "cost": null,
  "min_list_price": null,
  "min_cost": null,
  "roundup_qty": 0,
  "surcharges": null,
  "side_loader_surcharge": null,
  "created_at": "2026-03-01 00:00:00",
  "updated_at": null
}
```

---

### 13.9 Data Objects — Air Freight

**AirRateCard shape:**
```json
{
  "id": 1,
  "rate_card_key": "VNSGN:MYPKG:NON-DG:MH",
  "origin_port_code": "VNSGN",
  "destination_port_code": "MYPKG",
  "dg_class_code": "NON-DG",
  "airline_code": "MH",
  "code": "FR-AIR",
  "description": "",
  "is_active": true,
  "created_at": "2024-01-01 00:00:00",
  "updated_at": null
}
```

**AirRate shape (supplier cost row in `air_freight_rates`):**
```json
{
  "id": 101,
  "rate_card_id": 1,
  "supplier_id": "MH-CARGO",
  "effective_from": "2026-03-01",
  "effective_to": null,
  "rate_status": "PUBLISHED",
  "currency": "MYR",
  "l45_list_price": null,
  "p45_list_price": null,
  "p100_list_price": null,
  "p250_list_price": null,
  "p300_list_price": null,
  "p500_list_price": null,
  "p1000_list_price": null,
  "min_list_price": null,
  "l45_cost": 12.5,
  "p45_cost": 10.0,
  "p100_cost": 8.5,
  "p250_cost": 7.5,
  "p300_cost": 7.0,
  "p500_cost": 6.5,
  "p1000_cost": 6.0,
  "min_cost": 150.0,
  "surcharges": [ { "code": "FSC", "label": "Fuel Surcharge", "amount": 0.5 } ],
  "created_at": "2026-03-01 00:00:00",
  "updated_at": null
}
```

**AirListPriceRate shape (in `air_list_price_rates`, no `supplier_id`):**
```json
{
  "id": 10,
  "rate_card_id": 10,
  "effective_from": "2026-03-01",
  "effective_to": null,
  "rate_status": "PUBLISHED",
  "currency": "MYR",
  "l45_list_price": 14.0,
  "p45_list_price": 12.0,
  "p100_list_price": 10.0,
  "p250_list_price": 9.0,
  "p300_list_price": 8.5,
  "p500_list_price": 8.0,
  "p1000_list_price": 7.5,
  "min_list_price": 180.0,
  "surcharges": null,
  "created_at": "2026-03-01 00:00:00",
  "updated_at": null
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
| Port terminal CRUD | `port_terminals` table is read-only via API — no create/update/delete endpoints | Future |
| Pricing — rate card delete | No DELETE on rate cards; deactivate only via `is_active: false` — by design | By design |
| Pricing — quotation engine | Pricing data exists but no quotation/calculation endpoints yet (air resolve is a preview) | Future |
| Pricing — AFC access | All pricing endpoints are `require_afu` only — no customer-facing pricing API yet | Future |

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
| `PATCH /shipments/{id}/type-details` | `require_afu` |
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
| `GET /geography/port-terminals` | `require_auth` |
| `GET /geography/port-terminals/{terminal_id}` | `require_auth` |
| `GET /pricing/fcl/rate-cards` | `require_afu` |
| `GET /pricing/fcl/rate-cards/{card_id}` | `require_afu` |
| `POST /pricing/fcl/rate-cards` | `require_afu_admin` |
| `PATCH /pricing/fcl/rate-cards/{card_id}` | `require_afu_admin` |
| `GET /pricing/fcl/rate-cards/{card_id}/rates` | `require_afu` |
| `POST /pricing/fcl/rate-cards/{card_id}/rates` | `require_afu_admin` |
| `PATCH /pricing/fcl/rates/{rate_id}` | `require_afu_admin` |
| `DELETE /pricing/fcl/rates/{rate_id}` | `require_afu_admin` |
| `GET /pricing/lcl/rate-cards` | `require_afu` |
| `GET /pricing/lcl/rate-cards/{card_id}` | `require_afu` |
| `POST /pricing/lcl/rate-cards` | `require_afu_admin` |
| `PATCH /pricing/lcl/rate-cards/{card_id}` | `require_afu_admin` |
| `GET /pricing/lcl/rate-cards/{card_id}/rates` | `require_afu` |
| `POST /pricing/lcl/rate-cards/{card_id}/rates` | `require_afu_admin` |
| `PATCH /pricing/lcl/rates/{rate_id}` | `require_afu_admin` |
| `DELETE /pricing/lcl/rates/{rate_id}` | `require_afu_admin` |
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
| `GET /pricing/haulage/rate-cards` | `require_afu` |
| `GET /pricing/haulage/rate-cards/{card_id}` | `require_afu` |
| `POST /pricing/haulage/rate-cards` | `require_afu_admin` |
| `PATCH /pricing/haulage/rate-cards/{card_id}` | `require_afu_admin` |
| `GET /pricing/haulage/rate-cards/{card_id}/rates` | `require_afu` |
| `POST /pricing/haulage/rate-cards/{card_id}/rates` | `require_afu_admin` |
| `PATCH /pricing/haulage/rates/{rate_id}` | `require_afu_admin` |
| `DELETE /pricing/haulage/rates/{rate_id}` | `require_afu_admin` |
| `POST /pricing/haulage/rates/{rate_id}/publish` | `require_afu_admin` |
| `POST /pricing/haulage/rates/{rate_id}/reject` | `require_afu_admin` |
| `GET /pricing/haulage/depot-gate-fees` | `require_afu` |
| `GET /pricing/haulage/depot-gate-fees/active` | `require_afu` |
| `POST /pricing/haulage/depot-gate-fees` | `require_afu_admin` |
| `PATCH /pricing/haulage/depot-gate-fees/{fee_id}` | `require_afu_admin` |
| `DELETE /pricing/haulage/depot-gate-fees/{fee_id}` | `require_afu_admin` |
| `GET /pricing/haulage/supplier-rebates` | `require_afu` |
| `POST /pricing/haulage/supplier-rebates` | `require_afu` |
| `PATCH /pricing/haulage/supplier-rebates/{rebate_id}` | `require_afu` |
| `DELETE /pricing/haulage/supplier-rebates/{rebate_id}` | `require_afu` |
| `GET /pricing/haulage/faf-rates` | `require_afu` |
| `POST /pricing/haulage/faf-rates` | `require_afu` |
| `PATCH /pricing/haulage/faf-rates/{faf_id}` | `require_afu` |
| `DELETE /pricing/haulage/faf-rates/{faf_id}` | `require_afu` |
| `GET /pricing/air/rate-cards` | `require_afu` |
| `GET /pricing/air/rate-cards/{card_id}` | `require_afu` |
| `POST /pricing/air/rate-cards` | `require_afu_admin` |
| `PATCH /pricing/air/rate-cards/{card_id}` | `require_afu_admin` |
| `GET /pricing/air/rate-cards/{card_id}/rates` | `require_afu` |
| `POST /pricing/air/rate-cards/{card_id}/rates` | `require_afu_admin` |
| `PATCH /pricing/air/rates/{rate_id}` | `require_afu_admin` |
| `DELETE /pricing/air/rates/{rate_id}` | `require_afu_admin` |
| `POST /pricing/air/rates/{rate_id}/publish` | `require_afu_admin` |
| `POST /pricing/air/rates/{rate_id}/reject` | `require_afu_admin` |
| `GET /pricing/air/list-price-cards` | `require_afu` |
| `POST /pricing/air/list-price-cards` | `require_afu_admin` |
| `PATCH /pricing/air/list-price-cards/{card_id}` | `require_afu_admin` |
| `GET /pricing/air/list-price-cards/{card_id}/rates` | `require_afu` |
| `POST /pricing/air/list-price-cards/{card_id}/rates` | `require_afu_admin` |
| `PATCH /pricing/air/list-price-rates/{rate_id}` | `require_afu_admin` |
| `DELETE /pricing/air/list-price-rates/{rate_id}` | `require_afu_admin` |
| `POST /pricing/air/list-price-rates/{rate_id}/publish` | `require_afu_admin` |
| `POST /pricing/air/rate-cards/{card_id}/resolve` | `require_afu` |

---

*Last updated: 12 March 2026 — Contract v2.0*

**v2.0 changes:**
- Section 2.21: New — `PATCH /shipments/{id}/type-details` — edit container numbers and seal numbers within `type_details` JSONB (FCL by array index, LCL/AIR at top level)
- Section 13.7: Air rate card list response — documented `latest_cost_supplier_id` field (supplier with lowest current `p100_cost`); added full response JSON example with all new fields
- Section 13.7: Air rate card detail — added ⚠️ note clarifying `rates_by_supplier` contains supplier cost rows only (no `null` key); list price is exclusively in `list_price_rates`
- Section 13.7: Air list price cards — added ⚠️ note about auto-create behaviour from frontend (`createAirListPriceCardAction` triggered when `list_price_card_id` is `null`)
- Section 11: Open Items — pricing quotation engine note updated (air resolve is a preview endpoint)
- Section 12: Auth Dependency Map — added `PATCH /shipments/{id}/type-details`; added all haulage, air, and air list price endpoints (previously missing from map); map is now comprehensive

**v1.9 changes:**
- Section 13.6: New — Haulage pricing fully documented (rate cards, rates, depot gate fees, supplier rebates, FAF rates — all CRUD + publish/reject)
- Section 13.7: New — Air freight pricing fully documented (supplier rate cards + rates, list price cards + rates, resolve endpoint, data objects)
- Section 13.8: New — Haulage data objects (HaulageRateCard, HaulageRate)
- Section 13.9: New — Air freight data objects (AirRateCard, AirRate, AirListPriceRate)
- Section 12: Auth map partially updated (haulage and air endpoints added in this version but map was incomplete — corrected in v2.0)

**v1.8 changes:**
- Section 5.9: New — Port Terminals endpoints (`GET /geography/port-terminals`, `GET /geography/port-terminals/{terminal_id}`)
- Section 13: New — Pricing module fully documented (FCL and LCL rate cards + rates, data objects, key format, supplier vs price-reference rate concept)
- Section 11: Open Items updated — port terminal CRUD, pricing rate card delete (by design), quotation engine, AFC access noted as gaps
- Section 12: Auth Dependency Map updated with port-terminal and all pricing endpoints (18 new rows)

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
