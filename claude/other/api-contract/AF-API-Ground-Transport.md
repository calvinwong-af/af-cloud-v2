# AF API Contract — Ground Transport (Section 10)
*See AF-API-Index.md for conventions, auth roles, and auth map.*

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

Reconciles existing transport orders against a shipment's scope flags. Returns covered items and any gaps.

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
