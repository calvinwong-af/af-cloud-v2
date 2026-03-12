# AF API Contract — Shipments (Sections 2 & 9)
*See AF-API-Index.md for conventions, auth roles, and auth map.*

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

Clears parsed party data from `bl_document` after the user resolves a party diff. Prevents stale diff banners from re-appearing.

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

⚠️ **Deprecated for frontend use** — `PATCH /bl` now saves the BL file inline. For AWB and BC, the frontend calls `POST /files` directly after a successful apply. Retained for compatibility only.

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

**Auto status progression:**
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

**Auto status progression:**
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

Edits container numbers and seal numbers stored in the `type_details` JSONB. For FCL, patched by index within the containers array. For LCL/AIR, a single container number and seal number are set at the top level.

**Request body (FCL):**
```json
{
  "container_numbers": ["COSCU1234567", "COSCU7654321"],
  "seal_numbers": ["SL001", "SL002"]
}
```

Arrays are positionally mapped to the existing `type_details.containers` array. A `null` at any index is a no-op for that position. Arrays must not exceed the existing container count.

**Request body (LCL / AIR):**
```json
{
  "container_number": "COSCU1234567",
  "seal_number": "SL001"
}
```

Empty string (`""`) clears the value.

**Response:** `{ "status": "OK", "data": { "type_details": { ... } }, "msg": "Type details updated" }`

**Errors:** `400` — array length exceeds container count. `404` — shipment not found.

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
