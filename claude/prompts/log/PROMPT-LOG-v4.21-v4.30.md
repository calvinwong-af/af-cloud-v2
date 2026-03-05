# Prompt Completion Log — v4.21–v4.30

### [2026-03-05 23:00 UTC] — v4.25: Ground Transport UI
- **Status:** Completed
- **Tasks:**
  - Task 1: Added "Ground Transport" nav item to sidebar OPERATIONS section (AFU only, Container icon)
  - Task 2: Created GT list page with filter tabs (all/haulage/trucking/active/completed/cancelled), KPI cards, table with status badges, row click opens detail in new tab
  - Task 3: Created GT detail page with header (order ID, type/status badges, status dropdown, cancel button), order details card, cargo card, driver & vehicle card, legs card with inline sub-cards
  - Task 4: Created 3-step CreateGroundTransportModal (order type → cargo/equipment → first leg) with AddressInput integration
  - Task 5: Created AddressInput component with Type Address / Select Zone toggle, debounced geocode, auto city matching
  - Task 6: Added ScopeFlagsCard to shipment detail page with 7 toggle indicators + ScopeEditModal
  - Task 7: Added GroundTransportReconcileCard to shipment detail page showing linked GT orders + gaps with "Create" buttons
  - Added `scope` to JSONB parsing list in `get_shipment_by_id`
- **Files Modified:**
  - `af-platform/src/components/shell/Sidebar.tsx`
  - `af-platform/src/app/(platform)/ground-transport/page.tsx` (new)
  - `af-platform/src/app/(platform)/ground-transport/[id]/page.tsx` (new)
  - `af-platform/src/app/(platform)/ground-transport/[id]/_components.tsx` (new)
  - `af-platform/src/components/ground-transport/AddressInput.tsx` (new)
  - `af-platform/src/components/ground-transport/CreateGroundTransportModal.tsx` (new)
  - `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
  - `af-server/core/db_queries.py`

### [2026-03-05 22:00 UTC] — v4.24: Ground Transport Foundation
- **Status:** Completed
- **Tasks:**
  - Created `008_ground_transport.sql` migration: `ground_transport_orders` table, `ground_transport_legs` table, `scope` JSONB column on `shipments`, 4 indexes
  - Created `run_migration_008.py` script to execute migration
  - Added `generate_transport_order_id()` to `db_queries.py`
  - Created full `ground_transport.py` router: CRUD orders, add/update legs, reconcile shipment, update scope, geocode address (Google Maps API)
  - Registered router in `main.py` at `/api/v2/ground-transport`
  - Created `ground-transport.ts` server actions: 10 actions (create, list, get, update, cancel, addLeg, updateLeg, reconcile, updateScope, geocodeAddress)
- **Files Modified:**
  - `af-server/migrations/008_ground_transport.sql` (new)
  - `af-server/scripts/run_migration_008.py` (new)
  - `af-server/core/db_queries.py`
  - `af-server/routers/ground_transport.py` (new)
  - `af-server/main.py`
  - `af-platform/src/app/actions/ground-transport.ts` (new)

### [2026-03-05 21:30 UTC] — v4.23 BL-01: Search Pagination (Load More)
- **Status:** Completed
- **Tasks:**
  - Backend: Added `offset` query param to `GET /search`, added `total` and `next_cursor` to response. Updated `db_queries.search_shipments()` with `OFFSET` clause.
  - Frontend action: Updated `searchShipmentsAction` return type from `SearchResult[]` to `{ results, nextCursor, total }`. Added `offset` parameter.
  - QuickSearch: Updated call site to destructure `{ results: res }` from new return shape.
  - Shipments page: Added `searchNextCursor`, `searchTotal`, `loadingMoreSearch` state. Added `loadMoreSearch()` function. Updated count display to show "showing X of Y" when paginated. Added "Load more results" button for search results.
- **Files Modified:**
  - `af-server/routers/shipments/core.py`
  - `af-server/core/db_queries.py`
  - `af-platform/src/app/actions/shipments.ts`
  - `af-platform/src/components/shell/QuickSearch.tsx`
  - `af-platform/src/app/(platform)/shipments/page.tsx`

### [2026-03-05 21:00 UTC] — v4.22 BL-03: Transport Card Inline Edit
- **Status:** Completed
- **Tasks:**
  - Added `PATCH /api/v2/shipments/{shipment_id}/booking` endpoint — sea fields merge into booking JSONB, air flat columns (mawb_number, hawb_number, awb_type) update directly, flight_number/flight_date in booking JSONB
  - Added `updateBookingAction` server action in shipments-write.ts
  - Extracted Transport card IIFE into `TransportCard` exported component with pencil icon (AFU only)
  - Added `TransportEditModal` with sea mode (booking ref, vessel, voyage, carrier) and air mode (MAWB, HAWB, AWB type select, flight number, flight date)
  - Replaced IIFE in page.tsx with `<TransportCard>` + modal state
- **Files Modified:**
  - `af-server/routers/shipments/core.py`
  - `af-platform/src/app/actions/shipments-write.ts`
  - `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`

### [2026-03-05 20:30 UTC] — v-TD-01: Split _helpers.py into Domain Modules
- **Status:** Completed
- **Tasks:**
  - Split `_helpers.py` into 4 files: `_helpers.py` (core utils only), `_file_helpers.py` (GCS/file ops), `_port_helpers.py` (port/company matching), `_status_helpers.py` (status advancement, task helpers, system logging)
  - Updated imports in 7 sub-router files: `bl.py`, `core.py`, `doc_apply.py`, `files.py`, `route_nodes.py`, `status.py`, `tasks.py`
  - Zero logic changes — pure structural refactor
- **Files Modified:**
  - `af-server/routers/shipments/_helpers.py` (trimmed)
  - `af-server/routers/shipments/_file_helpers.py` (new)
  - `af-server/routers/shipments/_port_helpers.py` (new)
  - `af-server/routers/shipments/_status_helpers.py` (new)
  - `af-server/routers/shipments/bl.py`
  - `af-server/routers/shipments/core.py`
  - `af-server/routers/shipments/doc_apply.py`
  - `af-server/routers/shipments/files.py`
  - `af-server/routers/shipments/route_nodes.py`
  - `af-server/routers/shipments/tasks.py`

### [2026-03-05 20:15 UTC] — v-DISP-01: Port Name Format + Container Size Normalisation
- **Status:** Completed
- **Tasks:**
  - **Fix A:** Trimmed leading dashes (em-dash, en-dash, hyphen) from `port.name` in `getPortLabel()` via regex `^[\s\u2014\u2013\-]+`
  - **Fix B:** Added `normaliseContainerSize()` with `TYPE_SUFFIX_MAP` to convert raw carrier codes (e.g. `40FF` → `40' FR`, `20ST` → `20' GP`). Falls back to raw code if unrecognised.
- **Files Modified:**
  - `af-platform/src/lib/ports.ts`
  - `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`

### [2026-03-05 20:00 UTC] — v-GEO-06: FilterCombobox: Fix X Button Focus + Behaviour Sweep
- **Status:** Completed
- **Tasks:**
  - Added `useRef` for input element in `FilterCombobox`
  - X button now clears value, opens dropdown, and refocuses input via `setTimeout`
  - Dropdown now shows "No results" message when query matches nothing (instead of hiding entirely)
  - Verified existing behaviours (option select, Escape key, onBlur timing) still work correctly
- **Files Modified:**
  - `af-platform/src/app/(platform)/geography/_components.tsx`

### [2026-03-05 19:45 UTC] — v-GEO-05: Country Filter Label Consistency + China Provinces Seed
- **Status:** Completed
- **Tasks:**
  - **Change A:** Standardised country filter labels in StatesTab and CitiesTab to `${code} — ${name}` format by fetching countries data and building a `countryMap`. PortsTab and HaulageAreasTab already had correct format.
  - **Change B:** Created `run_migration_007.py` and seeded 33 China provinces/municipalities/autonomous regions/SARs into the `states` table using ISO 3166-2:CN codes.
- **Files Modified:**
  - `af-platform/src/app/(platform)/geography/_components.tsx`
  - `af-server/scripts/run_migration_007.py` (new)

### [2026-03-05 19:15 UTC] — v-GEO-04: Countries Tab: Remove Currency Symbol + Fix Euro Encoding
- **Status:** Completed
- **Tasks:**
  - **Change A:** Removed `currency_symbol` from all layers — `Country` interface, `updateCountryAction` params, `CountryUpdate` Pydantic model, `list_countries`/`get_country` SELECT queries, `update_country` field loop, `CountriesTab` table display, `CountryEditModal` state/field/payload.
  - **Change B:** Verified Euro symbol encoding — `€` (U+20AC) was already correctly stored in production DB (1 char, 3 bytes UTF-8). No mojibake present; no data fix needed.
- **Files Modified:**
  - `af-platform/src/app/(platform)/geography/_components.tsx`
  - `af-platform/src/app/actions/geography.ts`
  - `af-server/routers/geography.py`
