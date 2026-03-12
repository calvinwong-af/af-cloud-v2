# AF API Contract — Geography & Legacy Ports (Sections 5 & 6)
*See AF-API-Index.md for conventions, auth roles, and auth map.*

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
    { "terminal_id": "MYPKG_W", "name": "Westports", "label": "Westports", "port_un_code": "MYPKG" },
    { "terminal_id": "MYPKG_N", "name": "Northport", "label": "Northport", "port_un_code": "MYPKG" }
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
  "data": { "terminal_id": "MYPKG_W", "name": "Westports", "label": "Westports", "port_un_code": "MYPKG" }
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

#### `PATCH /geography/countries/{country_code}`
Auth: `require_afu`

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
