# AcceleFreight — AF Server V2 API Contract
**Base URL:** `https://af-server-667020632236.asia-northeast1.run.app/api/v2` (prod) · `http://localhost:8000/api/v2` (local)  
**Auth:** Firebase ID token — `Authorization: Bearer <token>` on all protected routes  
**Version:** Contract v1.2 — 03 March 2026  
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
| `require_afu` | AFU staff (any AFU role: AFU-ADMIN, AFU-SM, AFU-SE) | Read all data |
| `require_afu_admin` | AFU-ADMIN only | Write / create / delete |
| `require_super_admin` | Named super-admins only (calvin, isaac) | Dangerous ops |

**AFU Roles:** `AFU-ADMIN` · `AFU-SM` (Sales Manager) · `AFU-SE` (Sales Executive)  
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

**Response:** (no envelope — direct object)
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
  ]
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
  "workflow_tasks": [
    {
      "task_id": "booking",
      "label": "Arrange Booking",
      "status": "pending",
      "due_date": "2026-03-05",
      "completed_at": null,
      "completed_by": null,
      "notes": null
    }
  ],
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
  "shipper": {
    "name": "Supplier Vietnam Ltd",
    "address": "...",
    "contact_person": "...",
    "phone": "...",
    "email": "...",
    "company_id": null,
    "company_contact_id": null
  },
  "consignee": { ... },
  "notify_party": { ... },
  "cargo_ready_date": "2026-02-15",
  "etd": "2026-03-10",
  "eta": "2026-03-25"
}
```

`order_type` values: `SEA_FCL` | `SEA_LCL` | `AIR` | `CROSS_BORDER` | `GROUND` (last two reserved — not yet validated in create endpoint)  
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
{
  "deleted": true,
  "shipment_id": "AF-003874",
  "mode": "soft"
}
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

**Path A** (booking required — e.g. FOB EXPORT): `1002 → 2001 → 3001 → 3002 → 4001 → 4002 → 5001`  
**Path B** (no booking — e.g. CNF IMPORT): `1002 → 2001 → 4001 → 4002 → 5001`

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

Returns the full status history array.

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

### 2.8 Invoiced Flag

#### `PATCH /shipments/{shipment_id}/invoiced`
Auth: `require_afu`  
Shipment must be at status `5001` (Completed).

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

---

### 2.9 Exception Flag

#### `PATCH /shipments/{shipment_id}/exception`
Auth: `require_auth` (AFC: admin/manager only; AFU: all)

**Request body:**
```json
{
  "flagged": true,
  "notes": "Container damaged on arrival"
}
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

### 2.10 Reassign Company

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

### 2.11 Bill of Lading (BL)

#### `POST /shipments/parse-bl`
Auth: `require_afu`  
Request: `multipart/form-data` with `file` field (PDF, PNG, JPEG, or WebP).

Classifies the document (BL / AWB / Booking Confirmation) then extracts structured fields via Claude API. Returns parsed data + derived port codes + company matches.

**Response:**
```json
{
  "parsed": {
    "waybill_number": "COSCO12345678",
    "vessel_name": "CSCL GLOBE",
    "voyage_number": "V0123",
    "port_of_loading": "Ho Chi Minh City",
    "port_of_discharge": "Port Klang",
    "on_board_date": "2026-03-10",
    "shipper_name": "Supplier Vietnam Ltd",
    "shipper_address": "123 Industrial Rd, HCMC",
    "consignee_name": "Acme Corp Sdn Bhd",
    "consignee_address": "...",
    "notify_party_name": null,
    "cargo_description": "Electronic Components",
    "containers": [
      { "container_number": "COSCU1234567", "container_type": "40HC", "seal_number": "SL001" }
    ]
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
For `AWB` responses, `parsed` contains AWB-specific fields (`origin_iata`, `dest_iata`, `mawb_number`, `hawb_number`, etc.).

---

#### `POST /shipments/create-from-bl`
Auth: `require_afu`  
Create a new V2 shipment from parsed BL/AWB/BC data. Creates shipment + workflow + auto-generates tasks.

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

**Response:**
```json
{ "status": "OK", "data": { "shipment_id": "AF-003874" }, "msg": "Shipment created from BL" }
```

---

#### `PATCH /shipments/{shipment_id}/bl`
Auth: `require_afu`  
Request: `multipart/form-data`

Apply parsed BL data to an existing shipment. Merges booking fields, parties, containers, and optionally uploads the BL file. Parties only overwrite if empty unless `force_update=true`.

**Form fields:**

| Field | Type | Notes |
|---|---|---|
| `waybill_number` | string | Booking reference / BL number |
| `carrier` | string | |
| `carrier_agent` | string | Preferred over `carrier` |
| `vessel_name` | string | |
| `voyage_number` | string | |
| `etd` | string | YYYY-MM-DD |
| `shipper_name` | string | |
| `shipper_address` | string | |
| `consignee_name` | string | |
| `consignee_address` | string | |
| `notify_party_name` | string | |
| `bl_shipper_name` | string | Raw parsed value — stored in `bl_document` |
| `bl_consignee_name` | string | Raw parsed value — stored in `bl_document` |
| `containers` | JSON string | Array of container objects |
| `cargo_items` | JSON string | Array of cargo items (LCL) |
| `origin_port` | string | UN code |
| `dest_port` | string | UN code |
| `force_update` | string | `"true"` to overwrite existing party data |
| `file` | binary | Optional BL PDF to attach |

**Response:**
```json
{
  "status": "OK",
  "data": {
    "shipment_id": "AF-003873",
    "booking": { "booking_reference": "COSCO12345678", "vessel_name": "CSCL GLOBE", ... },
    "parties": { "shipper": { ... }, "consignee": { ... } },
    "bl_document": { "shipper": { ... }, "consignee": { ... } },
    "etd": "2026-03-10",
    "origin_port": null,
    "dest_port": null
  },
  "msg": "Shipment updated from BL"
}
```

---

#### `PATCH /shipments/{shipment_id}/parties`
Auth: `require_afu`  
Update shipper/consignee/notify_party directly (without a BL upload). Empty string clears a field; `null` / omitted = no change.

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

**Response:**
```json
{ "status": "OK", "data": { "parties": { ... } } }
```

---

#### `POST /shipments/{shipment_id}/apply-booking-confirmation`
Auth: `require_afu`  
Apply booking confirmation data to an existing shipment. Updates `booking` JSONB, flat `etd`/`eta` columns, and route node timings if nodes exist.

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
  "containers": null,
  "cargo_description": null,
  "hs_code": null,
  "cargo_weight_kg": null
}
```

**Response:** `{ "shipment_id": "AF-003873", "status": "OK" }`

---

#### `POST /shipments/{shipment_id}/apply-awb`
Auth: `require_afu`  
Apply AWB data to an existing AIR shipment. Updates flat AWB columns, `booking` JSONB, `parties` JSONB, and flat `etd` (from `flight_date`).

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

**Response:** `{ "shipment_id": "AF-003873", "status": "OK" }`

---

#### `POST /shipments/{shipment_id}/save-document-file`
Auth: `require_afu`  
Request: `multipart/form-data` with `file` (binary) and `doc_type` (string: `AWB` | `BC` | `BL`).  
Saves an uploaded document to GCS and creates a `shipment_files` record with the appropriate tag. Called by the frontend after `apply-awb` or `apply-booking-confirmation` succeeds.

**Response:** `{ "status": "OK", "data": <FileRecord> }`

---

### 2.12 Shipment Files

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
⚠️ No signed download URL in the list response — use the separate download endpoint.

#### `POST /shipments/{shipment_id}/files`
Auth: `require_auth` (AFU all; AFC Admin/Manager only — AFC regular is 403)  
Request: `multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `file` | binary | Required |
| `file_tags` | JSON string | e.g. `["hbl", "mbl"]`. Default `[]` |
| `visibility` | string | `"true"` or `"false"`. Default `"true"` |

**Response:** `{ "status": "OK", "data": <FileRecord>, "msg": "File uploaded" }`

#### `GET /shipments/{shipment_id}/files/{file_id}/download`
Auth: `require_auth`  
Generates a 15-minute signed GCS URL for the file. AFC regular users cannot download hidden files.

**Response:** `{ "download_url": "https://storage.googleapis.com/...?X-Goog-Signature=..." }`

#### `PATCH /shipments/{shipment_id}/files/{file_id}`
Auth: `require_auth` (AFU all; AFC Admin/Manager only)  
All fields optional.

**Request body:**
```json
{ "file_tags": ["hbl"], "visibility": true }
```
⚠️ AFC Admin/Manager cannot change `visibility` — only AFU staff can.

**Response:** `{ "status": "OK", "data": <FileRecord>, "msg": "File updated" }`

#### `DELETE /shipments/{shipment_id}/files/{file_id}`
Auth: `require_afu`  
Soft delete only — sets `trash=TRUE`. No hard delete on files.

**Response:** `{ "deleted": true, "file_id": 1234 }`

---

### 2.13 Workflow Tasks

#### `GET /shipments/{shipment_id}/tasks`
Auth: `require_auth`  
Auto-generates tasks on first access if none exist. AFC regular users have hidden tasks (`visibility=HIDDEN`) filtered out.

**Response:** (no envelope)
```json
{
  "shipment_id": "AF-003873",
  "tasks": [
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
  ]
}
```

**Task status values:** `pending` | `in_progress` | `completed` | `blocked`  
**Task mode values:** `ASSIGNED` | `TRACKED` | `IGNORED`  
**assigned_to values:** `AF` | `CUSTOMER` | `THIRD_PARTY`

#### `PATCH /shipments/{shipment_id}/tasks/{task_id}`
Auth: `require_auth`  
Permissions: AFU — all fields. AFC Admin/Manager — all except `visibility`. AFC regular — 403.

**Request body:** (all fields optional)
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

**Response:** `{ "status": "OK", "data": <TaskObject>, "msg": "Task updated", "warning": "..." (optional) }`  
⚠️ If `FREIGHT_BOOKING` task is completed but `booking_reference` is not set on the shipment, a `warning` field is returned and `EXPORT_CLEARANCE` remains `BLOCKED`.

---

### 2.14 Route Nodes

#### `GET /shipments/{shipment_id}/route-nodes`
Auth: `require_auth`  
If no route nodes are saved, derives them from the shipment's `origin_port` and `dest_port` fields. Enriches all nodes with port names from the `ports` table.

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
    },
    {
      "port_un_code": "MYPKG",
      "port_name": "Port Klang",
      "country": "MY",
      "port_type": "SEA",
      "role": "DESTINATION",
      "sequence": 2,
      "scheduled_eta": "2026-03-25",
      "actual_eta": null,
      "scheduled_etd": null,
      "actual_etd": null
    }
  ],
  "derived": true
}
```
`derived: true` means nodes were inferred from port fields, not saved explicitly.

#### `PUT /shipments/{shipment_id}/route-nodes`
Auth: `require_auth` (AFC Admin/Manager or AFU)  
Replaces the full route nodes array. Validates exactly one ORIGIN and one DESTINATION. Auto-assigns sequence numbers. Syncs ORIGIN `scheduled_etd` → flat `etd` and DESTINATION `scheduled_eta` → flat `eta`.

**Request body:** Array of node objects:
```json
[
  { "port_un_code": "VNSGN", "port_name": "Ho Chi Minh City", "role": "ORIGIN", "scheduled_etd": "2026-03-10" },
  { "port_un_code": "SGSIN", "port_name": "Singapore", "role": "TRANSHIP", "scheduled_eta": "2026-03-14", "scheduled_etd": "2026-03-15" },
  { "port_un_code": "MYPKG", "port_name": "Port Klang", "role": "DESTINATION", "scheduled_eta": "2026-03-25" }
]
```
`role` values: `ORIGIN` | `TRANSHIP` | `DESTINATION`

**Response:** `{ "shipment_id": "AF-003873", "route_nodes": [ ... ] }` (enriched with port details)

#### `PATCH /shipments/{shipment_id}/route-nodes/{sequence}`
Auth: `require_auth` (AFC Admin/Manager or AFU)  
Update timing fields on a single node by sequence number. Syncs flat `etd`/`eta` if ORIGIN/DESTINATION node.

**Request body:** (all optional)
```json
{
  "scheduled_eta": null,
  "actual_eta": null,
  "scheduled_etd": "2026-03-10",
  "actual_etd": null
}
```

**Response:** `{ "shipment_id": "AF-003873", "node": { ... } }`

---

### 2.15 File Tags

#### `GET /shipments/file-tags`
Auth: `require_auth`

Returns all available file tags.

**Response:**
```json
{
  "status": "OK",
  "data": [
    { "tag_id": "hbl", "name": "House Bill of Lading", "color": "#3b9eff" }
  ]
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
  "data": [
    {
      "company_id": "AFC-000412",
      "id": "AFC-000412",
      "name": "Acme Corp Sdn Bhd",
      "short_name": "Acme",
      "account_type": "AFC",
      "email": "admin@acme.com",
      "phone": "+60 3 1234 5678",
      "approved": true,
      "has_platform_access": true,
      "xero_contact_id": "uuid...",
      "trash": false,
      "created_at": "2023-01-15T08:00:00+00:00",
      "updated_at": "2026-02-01T10:00:00+00:00"
    }
  ],
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
  "data": {
    "total": 641,
    "approved": 589,
    "with_access": 412,
    "xero_synced": 398
  }
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
    "address": {
      "line1": "Suite 5A, Menara ABC",
      "city": "Petaling Jaya",
      "state": "Selangor",
      "postcode": "47810",
      "country": "Malaysia"
    },
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

**Response:**
```json
{
  "status": "OK",
  "data": { "company_id": "AFC-000642", "name": "New Logistics Sdn Bhd" },
  "msg": "Company created"
}
```

### 3.5 Update Company

#### `PATCH /companies/{company_id}`
Auth: `require_afu`  
All fields optional — only provided fields are updated.

**Request body:**
```json
{
  "name": "Updated Name Sdn Bhd",
  "email": "new@email.com",
  "approved": true,
  "has_platform_access": false
}
```

**Response:**
```json
{ "status": "OK", "msg": "Company updated" }
```

---

## 4. Users

Base path: `/api/v2/users`  
**Status:** Complete — implemented in v2.81. `_build_claims` in `auth.py` now reads from the PostgreSQL `users` table on every authenticated request (single keyed lookup by UID).

### User Record Shape

All user endpoints return this shape:

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

`company_name` is resolved from `companies.short_name` (falls back to `companies.name`). `validated` is `email_validated` from the `users` table.

---

### 4.1 Get Current User

#### `GET /users/me`
Auth: `require_auth`

Returns the profile of the currently authenticated user. This is also the endpoint called by `verifySessionAndRole` in af-platform on every protected page load.

**Response:**
```json
{ "status": "OK", "data": <UserRecord> }
```

---

### 4.2 List Users

#### `GET /users`
Auth: `require_afu_admin`

Returns all users ordered AFU first, then alphabetical by last name.

**Response:**
```json
{ "status": "OK", "data": [ <UserRecord>, ... ] }
```

---

### 4.3 Create User

#### `POST /users`
Auth: `require_afu_admin`

Creates a Firebase Auth user and inserts into the `users` PostgreSQL table. User is active (`valid_access=TRUE`) by default.

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

**Response:**
```json
{ "status": "OK", "data": { "uid": "firebase_uid_abc" } }
```

**Errors:**
- `409` — email already registered in Firebase Auth
- `400` — weak password or invalid email

---

### 4.4 Update User

#### `PATCH /users/{uid}`
Auth: `require_afu_admin`

All fields optional — only provided fields are updated. Syncs `display_name` and `disabled` flag to Firebase Auth automatically.

**Request body:**
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "phone_number": "+60 12 345 6789",
  "role": "AFC-ADMIN",
  "valid_access": true,
  "company_id": "AFC-000413"
}
```

⚠️ Setting `valid_access: false` disables the Firebase Auth account immediately — the user cannot log in on their next request.

**Response:** `{ "status": "OK" }`

---

### 4.5 Delete User

#### `DELETE /users/{uid}`
Auth: `require_afu_admin`

Permanently deletes the user from Firebase Auth and the `users` table. Non-fatal if the Firebase Auth user is already gone.

**Response:** `{ "status": "OK" }`

---

### 4.6 Reset Password (Admin Set)

#### `POST /users/{uid}/reset-password`
Auth: `require_afu_admin`

Sets a new password directly via Firebase Auth Admin SDK. Minimum 8 characters.

**Request body:**
```json
{ "new_password": "NewSecure456!" }
```

**Response:** `{ "status": "OK" }`

**Errors:**
- `400` — password too short or too weak
- `404` — user not found in Firebase Auth

---

### 4.7 Send Password Reset Email

#### `POST /users/{uid}/send-reset-email`
Auth: `require_afu_admin`

Sends a Firebase password reset email to the user's registered address via the Firebase Identity Toolkit REST API. Requires `FIREBASE_API_KEY` env var on the server.

**Response:** `{ "status": "OK" }`

**Errors:**
- `404` — user not found in Firebase Auth
- `400` — user has no email address
- `502` — Firebase REST API call failed

---

## 5. Geography

Base path: `/api/v2/geography`

### 5.1 List Ports

#### `GET /geography/ports`
Auth: `require_auth`  
10-minute in-memory cache on server.

**Response:**
```json
{
  "status": "OK",
  "data": [
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
      ]
    }
  ]
}
```

### 5.2 Get Port

#### `GET /geography/ports/{un_code}`
Auth: `require_auth`

Returns single port. Same shape as list item above.

### 5.3 List Countries

#### `GET /geography/countries`
Auth: `require_auth`  
**Status:** Stub — returns empty array.

---

## 6. Ports (Legacy Endpoint)

Base path: `/api/v2/ports`  
**Note:** Unauthenticated version of the geography ports endpoint. Use `/geography/ports` for authenticated callers going forward. This endpoint exists for backward compatibility.

#### `GET /ports`
No auth required. Returns all ports.

#### `GET /ports/{un_code}`
No auth required. Returns single port.

---

## 7. Files

Base path: `/api/v2/files`  
**Status:** Implementation in progress — refer to shipment files sub-endpoints (`/shipments/{id}/files`) for current file operations.

---

## 8. AI

Base path: `/api/v2/ai`  
**Status:** Stub — future Claude-powered backend workers.

Planned endpoints:
- `POST /ai/parse-bl` — BL PDF parsing
- `POST /ai/generate-tasks` — Incoterm task generation from shipment context
- `POST /ai/extract-supplier-data` — Email supplier data extraction

---

## 9. Data Objects — Reference Shapes

### 9.1 Party Object (shipper / consignee / notify_party)
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
`company_id` and `company_contact_id` are set when the party is a registered AF company. Otherwise `null`.

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
`container_number` and `seal_number` are populated post-booking; `null` at creation.

### 9.3 Package Object (LCL / AIR)
```json
{
  "packaging_type": "CARTON",
  "quantity": 50,
  "gross_weight_kg": 500.0,
  "volume_cbm": 2.5
}
```

### 9.4 Port Terminal Object
```json
{
  "terminal_id": "MYPKG_W",
  "name": "Westports",
  "label": "Westports"
}
```

### 9.5 Origin / Destination Object
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
`type` is always `"PORT"` for V2 shipments. `city_id` and `address` reserved for future inland/door-to-door.

### 9.6 Exception Data Object
```json
{
  "flagged": false,
  "raised_at": null,
  "raised_by": null,
  "notes": null
}
```

### 9.7 Cargo Object
```json
{
  "description": "Electronic Components",
  "hs_code": "8542.31",
  "is_dg": false,
  "dg_class": null,
  "dg_un_number": null
}
```
⚠️ V1 migrated shipments may have `dg_classification` as a nested object instead of `is_dg` boolean — normalise on read.

### 9.8 Workflow Task Object
```json
{
  "task_id": "booking",
  "label": "Arrange Booking",
  "status": "pending",
  "due_date": "2026-03-05",
  "completed_at": null,
  "completed_by": null,
  "notes": null
}
```
`status` values: `pending` | `in_progress` | `completed` | `blocked` | `n/a`

---

## 10. Open Items / Known Gaps

| Item | Detail | Target |
|---|---|---|
| Users router | ✅ Complete — implemented v2.81, `_build_claims` migrated to PostgreSQL | Done |
| DG cargo | `Cargo.is_dg` vs `dg_classification` mismatch from V1 migration | v2.82 |
| Invoice endpoints | No endpoints defined yet — V1 reads still from Datastore | Future |
| Quotation endpoints | Not yet built for V2 | Future |
| Geography/countries | Stub — no implementation | Future |
| Files base router | `/api/v2/files` not yet wired up | Future |
| `GET /shipments/{id}/bl` | No dedicated GET endpoint — `bl_document` is returned in `GET /shipments/{id}` | N/A — by design |
| Pagination standard | List responses use different cursor formats — standardise | Future |
| Envelope consistency | Some list endpoints return no envelope — standardise | Future |
| Pricing endpoints | Not in V2 yet | Future |
| Xero webhook | Invoice sync not in V2 yet | Future |

---

## 11. Auth Dependency Map

Quick reference — which auth level each endpoint requires:

| Endpoint | Auth |
|---|---|
| `GET /` | None |
| `GET /ports` | None |
| `GET /ports/{code}` | None |
| `GET /geography/ports` | `require_auth` |
| `GET /geography/ports/{code}` | `require_auth` |
| `GET /shipments/stats` | `require_auth` |
| `GET /shipments/search` | `require_auth` |
| `GET /shipments/` | `require_auth` |
| `GET /shipments/{id}` | `require_auth` |
| `GET /shipments/{id}/status-history` | `require_auth` |
| `GET /shipments/{id}/files` | `require_auth` |
| `GET /shipments/{id}/tasks` | `require_auth` |
| `GET /shipments/file-tags` | `require_auth` |
| `POST /shipments/` | `require_afu_admin` |
| `DELETE /shipments/{id}` | `require_afu_admin` |
| `PATCH /shipments/{id}/status` | `require_afu` |
| `PATCH /shipments/{id}/invoiced` | `require_afu` |
| `PATCH /shipments/{id}/exception` | `require_auth` (AFC role-gated internally) |
| `PATCH /shipments/{id}/company` | `require_afu` |
| `POST /shipments/{id}/files` | `require_auth` (AFC role-gated internally) |
| `GET /shipments/{id}/files/{fid}/download` | `require_auth` |
| `PATCH /shipments/{id}/files/{fid}` | `require_auth` (AFC role-gated internally) |
| `DELETE /shipments/{id}/files/{fid}` | `require_afu` |
| `GET /shipments/{id}/tasks` | `require_auth` |
| `PATCH /shipments/{id}/tasks/{tid}` | `require_auth` (AFC role-gated internally) |
| `GET /shipments/{id}/route-nodes` | `require_auth` |
| `PUT /shipments/{id}/route-nodes` | `require_auth` (AFC role-gated internally) |
| `PATCH /shipments/{id}/route-nodes/{seq}` | `require_auth` (AFC role-gated internally) |
| `POST /shipments/parse-bl` | `require_afu` |
| `POST /shipments/create-from-bl` | `require_afu` |
| `PATCH /shipments/{id}/bl` | `require_afu` |
| `PATCH /shipments/{id}/parties` | `require_afu` |
| `POST /shipments/{id}/apply-booking-confirmation` | `require_afu` |
| `POST /shipments/{id}/apply-awb` | `require_afu` |
| `POST /shipments/{id}/save-document-file` | `require_afu` |
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

---

*Last updated: 03 March 2026 — Contract v1.2*  
*Next update: After v2.83 debug session resolves (shipments list empty issue)*
