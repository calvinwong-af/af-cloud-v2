# AF API Contract — Pricing (Sections 11 & 13)
*See AF-API-Index.md for conventions, auth roles, and auth map.*

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
      "null": [ <FCLRateObject>, ... ],
      "COSCO": [ <FCLRateObject>, ... ]
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
All fields optional. Same shape as POST.

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

### 13.5 Data Objects — FCL & LCL

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

Returns matching rate cards with: `latest_price_ref`, `pending_draft_count`, `time_series` (12-month), `latest_list_price_from`, `latest_cost_from`. Joined with area name, area code, state name, and terminal name.

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

`alerts_only: true` — filters to cards with any alert condition.

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

`close_previous: true` — sets `effective_to = effective_from - 1 day` on the most recent open-ended row for the same card and supplier.  
`side_loader_surcharge` — additional charge when side-loader equipment is used.  
`surcharges` — JSON array of `{ "code": "HA-FAF", "label": "Fuel Adjustment", "amount": 20.0 }` objects.

##### `PATCH /pricing/haulage/rates/{rate_id}`
Auth: `require_afu_admin`  
All fields optional. `effective_to` can be set to `null` to re-open a closed row.

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

Returns the single currently active fee row.

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

Supplier rebates are percentage-based cost reductions (cost side only), varying by supplier, port, and container size. `container_size` includes side-loader variants.

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

`rebate_percent` is stored as a decimal (e.g. `0.05` = 5%). Uniqueness enforced on `(supplier_id, port_un_code, container_size, effective_from)`.

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

FAF rates are supplier-level, covering multiple ports per entry via a `port_rates` JSON array.

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
- `latest_price_ref` — most recent published entry from the matching list price card
- `pending_draft_count`
- `latest_cost_from` / `latest_list_price_from`
- `latest_cost_supplier_id` — `supplier_id` of the supplier with the lowest current `p100_cost` across all airlines on this O/D lane
- `time_series` — 12-month array

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
- `rates_by_supplier` — map of `supplier_id` (non-null only) → rate arrays
- `list_price_card_id` — ID of the matching list price card (`null` if not yet created)
- `list_price_rates` — flat array of list price rate rows
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

All `_list_price` breakpoint fields are also accepted but typically `null` on supplier cost rows.

**Response:** `{ "status": "OK", "data": { "id": 101, "rate_card_id": 1, "created_at": "..." } }`

##### `PATCH /pricing/air/rates/{rate_id}`
Auth: `require_afu_admin`  
All fields optional. `effective_to` and `surcharges` require explicit presence to be updated.

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

List price cards exist at the O/D+DG level (no airline dimension). They hold the customer-facing breakpoint rates for the entire lane.

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

⚠️ List price cards can also be **auto-created** by the frontend when saving a list price rate and no matching card exists yet (`createAirListPriceCardAction` triggered when `list_price_card_id` is `null`).

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

`reference_date` is optional (defaults to today).

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

**Tier selection:** `l45` <45kg → `p45` ≥45 → `p100` ≥100 → `p250` ≥250 → `p300` ≥300 → `p500` ≥500 → `p1000` ≥1000  
**Charge:** `base_charge = max(weight × tier_rate, min_rate)` · `surcharge_amount = weight × surcharge_total_per_kg` · `total_charge = base_charge + surcharge_amount`

⚠️ Surcharge applies on actual weight even when the min charge floor is triggered.

**Errors:** `404` — no active rate found. `400` — `chargeable_weight` must be > 0.

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

*Last updated: 12 March 2026 — Contract v2.0*
