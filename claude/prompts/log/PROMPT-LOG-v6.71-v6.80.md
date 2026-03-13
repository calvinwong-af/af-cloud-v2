## Prompt Log — v6.71 to v6.80

### [2026-03-15 08:00 UTC] — v6.80: Restore Area Assignment in ScopeConfigModal → GT Order
- **Status:** Completed
- **Tasks:**
  - A: Added `setHaulageAreaAction` + `SetHaulageAreaPayload` to `ground-transport.ts` — encapsulates find-or-create GT order + update stop area_id logic
  - B: Verified `fetchHaulageAreasAction` and `/haulage-areas` endpoint already exist (geography.ts / geography.py)
  - C: Restored area UI in `ScopeConfigModal.tsx` — area state, fetch on mount/toggle, combobox under ASSIGNED haulage legs, area validation in `canGoNext()`, area save via `setHaulageAreaAction` in `handleSubmit`, area name display in Step 2 review
  - D1: Updated `shipments/[id]/page.tsx` — restored `containerSizes`, added `containerNumbers`, passes port/container props to both ScopeConfigModal and CreateQuotationModal
  - D2: Updated `CreateQuotationModal.tsx` — added port/container props passthrough
  - D3: Updated `quotations/[ref]/_components.tsx` — passes `originPortCode`/`destinationPortCode` to ScopeConfigModal
- **Files Modified:**
  - `af-platform/src/app/actions/ground-transport.ts`
  - `af-platform/src/components/shared/ScopeConfigModal.tsx`
  - `af-platform/src/components/shipments/CreateQuotationModal.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
  - `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`
- **Notes:** py_compile and ESLint clean. No backend changes needed — geography endpoint and GT order APIs already existed. Area is now stored on `order_stops.area_id` via GT orders, pricing engine already reads from there via `_get_gt_area_id()`.

### [2026-03-15 07:00 UTC] — v6.79: Scope/Area Architecture Cleanup
- **Status:** Completed
- **Tasks:**
  - Migration 061: Drops `scope_transport` from `shipment_details` and `transport_details` from `quotations` + runner script
  - Backend `scope.py`: Removed all `scope_transport` references from GET/PATCH, UpdateScopeRequest, and response
  - Backend `quotations.py`: Removed `TransportDetail` model, `transport_details` from all SELECTs/serialiser/INSERT, removed `PATCH /transport-details` endpoint, added `_get_gt_area_id()` and `_get_gt_vehicle_type()` helpers that query GT orders via `parent_shipment_id`, updated `_resolve_haulage` and `_resolve_ground_transport` to use new helpers instead of `transport_details`
  - Frontend `quotations.ts`: Removed `QuotationTransportDetail` type, `transport_details` from `CreateQuotationPayload` and `Quotation`, deleted `updateQuotationTransportDetailsAction`
  - Frontend `ground-transport.ts`: Removed `ScopeTransportLeg` type, reverted `ScopeData` to `{ tlx_release: boolean }`, removed `scope_transport` from `updateShipmentScopeAction` payload
  - Rewrote `ScopeConfigModal.tsx`: Stripped all area/vehicle/transport UI, removed imports of deleted types, simplified props (removed `originPortCode`, `destinationPortCode`, `containerSizes`, `currentTransportDetails`), changed `onScopeUpdated` to 2-param signature
  - Updated `CreateQuotationModal.tsx`: Removed `originPortCode`, `destinationPortCode`, `containerSizes` props
  - Updated `shipments/[id]/page.tsx`: Removed port/container props from ScopeConfigModal and CreateQuotationModal, removed unused `containerSizes` variable
  - Updated `quotations/[ref]/_components.tsx`: Removed transport details UI section, area resolution code, `getTransportLabel` function, updated ScopeConfigModal to 2-param `onScopeUpdated`, removed unused imports
- **Files Modified:**
  - `af-server/migrations/061_cleanup_scope_area.sql` (NEW)
  - `af-server/scripts/run_migration_061.py` (NEW)
  - `af-server/routers/shipments/scope.py`
  - `af-server/routers/quotations.py`
  - `af-platform/src/app/actions/quotations.ts`
  - `af-platform/src/app/actions/ground-transport.ts`
  - `af-platform/src/components/shared/ScopeConfigModal.tsx`
  - `af-platform/src/components/shipments/CreateQuotationModal.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
  - `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`
- **Notes:** py_compile and ESLint clean. Migration 061 must be run before deploy. Area/vehicle data now lives solely on GT orders (order_stops.area_id, order_legs.vehicle_type_id) — pricing engine queries these directly.

### [2026-03-15 06:00 UTC] — v6.78: Unified ScopeConfigModal (Replaces All Scope UI Components)
- **Status:** Completed
- **Tasks:**
  - Migration 060: Added `scope_transport` JSONB column to `shipment_details` + runner script
  - Backend `scope.py`: Added `scope_transport` to `UpdateScopeRequest`, GET returns it, PATCH saves it
  - Backend `quotations.py`: `create_quotation` inherits `scope_transport` when `transport_details` empty
  - Frontend `ground-transport.ts`: Added `ScopeTransportLeg` type, extended `ScopeData` with `scope_transport`, extended `updateShipmentScopeAction` payload
  - Created `ScopeConfigModal.tsx` — unified modal with `mode='configure'|'create-quotation'`, 2-step flow, scope toggles, TLX release, area/vehicle/address, review step, handles both shipment-only and quotation-context saves
  - Rewrote `CreateQuotationModal.tsx` as thin wrapper around `ScopeConfigModal`
  - Updated `shipments/[id]/page.tsx`: swapped `ScopeConfigDialog` → `ScopeConfigModal` with port/container props
  - Updated `quotations/[ref]/_components.tsx`: swapped `EditScopeModal` → `ScopeConfigModal` with `onScopeUpdated` callback
  - Deleted `ScopeConfigDialog.tsx` and `EditScopeModal.tsx`
- **Files Modified:**
  - `af-server/migrations/060_scope_transport.sql` (NEW)
  - `af-server/scripts/run_migration_060.py` (NEW)
  - `af-server/routers/shipments/scope.py`
  - `af-server/routers/quotations.py`
  - `af-platform/src/app/actions/ground-transport.ts`
  - `af-platform/src/components/shared/ScopeConfigModal.tsx` (NEW)
  - `af-platform/src/components/shipments/CreateQuotationModal.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
  - `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`
  - `af-platform/src/components/shipments/ScopeConfigDialog.tsx` (DELETED)
  - `af-platform/src/components/quotations/EditScopeModal.tsx` (DELETED)
- **Notes:** py_compile and ESLint clean. Migration 060 must be run before deploy. INCOTERM_TASK_RULES now lives only in ScopeConfigModal.tsx.

### [2026-03-15 04:30 UTC] — v6.77: Scope UI Tweaks + Area Editing in Configure Scope
- **Status:** Completed
- **Tasks:**
  - Change 1: Moved TLX Release row back to top (before scope toggle loop) in `ScopeConfigDialog.tsx` and `CreateQuotationModal.tsx`; already at top in rewritten `EditScopeModal.tsx`. Removed `border-l-2 border-sky-100` indentation styling.
  - Change 2: Renamed "Edit Scope" → "Configure Scope" — modal title in `EditScopeModal.tsx` and button label in `_components.tsx`
  - Change 3: Added area editing to `EditScopeModal.tsx` — new props (`currentTransportDetails`, `originPortCode`, `destinationPortCode`, `containerSizes`), area combobox for first_mile/last_mile when ASSIGNED, `updateQuotationTransportDetailsAction` on save. Backend: added `PATCH /quotations/{ref}/transport-details` endpoint, added `sd.origin_port`/`sd.dest_port` to all 3 quotation SELECT queries + serialiser. Frontend action: added `updateQuotationTransportDetailsAction`. Updated `Quotation` type with `origin_port_code`/`dest_port_code`. Parent `_components.tsx`: new props passed, onSaved callback updated to handle transport details.
  - Change 4: Confirmed no area editing needed in `ScopeConfigDialog.tsx` (shipment page)
- **Files Modified:**
  - `af-server/routers/quotations.py`
  - `af-platform/src/components/shipments/ScopeConfigDialog.tsx`
  - `af-platform/src/components/shipments/CreateQuotationModal.tsx`
  - `af-platform/src/components/quotations/EditScopeModal.tsx`
  - `af-platform/src/app/actions/quotations.ts`
  - `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`
- **Notes:** py_compile and ESLint clean. No commit/push per `/prompt` skill.

### [2026-03-15 03:00 UTC] — v6.76: Scope Standardisation: TLX Release Migration + Unified Scope UI
- **Status:** Completed
- **Tasks:**
  - A: Created migration 059 — moves `tlx_release` from `quotations` to `shipment_details` (ADD, backfill, DROP) + runner script
  - B: Backend `scope.py` — added `tlx_release: bool | None` to `UpdateScopeRequest`; GET returns `tlx_release` from `shipment_details`; PATCH saves `tlx_release` alongside scope flags
  - C: Backend `quotations.py` — changed all `q.tlx_release` references to `sd.tlx_release`; calculate endpoint joins `shipment_details`; `/tlx-release` PATCH now targets `shipment_details` via `shipment_id`
  - D: Frontend `ground-transport.ts` — removed `freight` from `ScopeFlags`; added `ScopeData extends ScopeFlags { tlx_release: boolean }`; updated `fetchShipmentScopeAction` return type and `updateShipmentScopeAction` signature
  - E: Frontend `ScopeConfigDialog.tsx` — removed `freight`; added `tlxRelease` state loaded from API; conditional TLX toggle after `export_clearance` (animated expand/collapse); passes `tlx_release` in save payload
  - F: Frontend `CreateQuotationModal.tsx` — removed `freight` from all incoterm rules; added `tlxRelease` state; conditional TLX toggle; "Not in Scope" label; Step 2 review badge uses `getModeLabel()`
  - G: Frontend `EditScopeModal.tsx` — removed `freight` from all incoterm rules + `ALL_SCOPE_KEYS`; TLX now conditional after `export_clearance` row (was unconditional first row); "Not in Scope" label
- **Files Modified:**
  - `af-server/migrations/059_scope_tlx_release.sql` (NEW)
  - `af-server/scripts/run_migration_059.py` (NEW)
  - `af-server/routers/shipments/scope.py`
  - `af-server/routers/quotations.py`
  - `af-platform/src/app/actions/ground-transport.ts`
  - `af-platform/src/components/shipments/ScopeConfigDialog.tsx`
  - `af-platform/src/components/shipments/CreateQuotationModal.tsx`
  - `af-platform/src/components/quotations/EditScopeModal.tsx`
- **Notes:** py_compile and ESLint clean. Migration 059 must be run before deploy. No commit/push per `/prompt` skill.

### [2026-03-15 02:00 UTC] — v6.75: Fix Customs Pricing: UOM-Aware Quantity Resolution
- **Status:** Completed
- **Tasks:** Replaced hardcoded `"uom": "SHIPMENT", "quantity": 1` in `_resolve_customs` with full UOM-aware quantity resolution matching the pattern used by `_resolve_local_charges` and `_resolve_dg_class_charges`. Now correctly handles CONTAINER (sums all containers for FCL), CBM/W/M/KG (LCL), CW_KG/KG/CBM (AIR), and defaults to 1.0 for SET/BL/SHIPMENT.
- **Files Modified:** `af-server/routers/quotations.py`
- **Notes:** SQL SELECT already had `crc.uom` at index 6 — no query change needed. py_compile clean.

### [2026-03-15 01:15 UTC] — v6.74: UOM Abbreviation + New Rate Modal UX Fix
- **Status:** Completed
- **Tasks:**
  - Change 1: UOM abbreviation — added `UOM_DISPLAY` map (`CONTAINER` → `CTR`) to all 3 table files and 3 modal files, applied via `uomLabel()` helper (tables) and `{UOM_DISPLAY[u] ?? u}` (modal `<option>` labels)
  - Change 2: New Rate Modal read-only card header — when `mode === 'new' && seed`, replaced editable card identity fields with read-only header (same pattern as edit-rate mode), hid checkboxes, updated title to `New Rate — {charge_code}`, simplified canSave to rate-only fields, updated handleSubmit to read card fields from seed via `seed?.field ?? stateField`
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/customs/_customs-table.tsx`
  - `af-platform/src/app/(platform)/pricing/customs/_customs-modal.tsx`
  - `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-table.tsx`
  - `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-modal.tsx`
  - `af-platform/src/app/(platform)/pricing/dg-class-charges/_dg-class-charges-table.tsx`
  - `af-platform/src/app/(platform)/pricing/dg-class-charges/_dg-class-charges-modal.tsx`
- **Notes:** ESLint passes clean. No commit/push per `/prompt` skill.

### [2026-03-15 00:30 UTC] — v6.73: Build Fix + Pricing Table/Modal UX Polish
- **Status:** Completed
- **Tasks:**
  - A: Fixed geography `a.state_code!.split` non-null assertion (line 304) + pre-existing `port_un_code` missing in createAreaAction (line 452)
  - B1: Replaced `Info` icon with `CreditCard` in all 3 table files, tooltip → "Edit card details"
  - B2: Reordered buttons to Pencil | Plus | CreditCard | Trash in all 3 table files
  - B3: Fixed Effective From/To label alignment in all 3 modals — moved "Remove end date" below input
  - B4: Added charge_code, trade_direction, shipment_type to edit-card mode (server action types + modal forms + handleSubmit payloads) in all 3 modules
  - B5: Added currency badge to card identity panel, removed currency from time-series cells in all 3 table files
  - Bonus: Fixed pre-existing TS errors — CreatePayload types missing `is_active`, string literal type mismatches, ScopeConfigDialog exhaustive switch
- **Files Modified:**
  - `af-platform/src/app/(platform)/geography/_components.tsx`
  - `af-platform/src/app/(platform)/pricing/customs/_customs-table.tsx`
  - `af-platform/src/app/(platform)/pricing/customs/_customs-modal.tsx`
  - `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-table.tsx`
  - `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-modal.tsx`
  - `af-platform/src/app/(platform)/pricing/dg-class-charges/_dg-class-charges-table.tsx`
  - `af-platform/src/app/(platform)/pricing/dg-class-charges/_dg-class-charges-modal.tsx`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/components/shipments/ScopeConfigDialog.tsx`
- **Notes:** Build passes clean. Backend routers already had charge_code/trade_direction/shipment_type in CardUpdate models with validation and key rebuild.

### [2026-03-14 23:15 UTC] — v6.72: DG Class Charges Frontend Rewrite (Two-Tier Schema)
- **Status:** Completed
- **Tasks:**
  - A: Added `card_id` to dg_class_charges.py `/cards` response
  - B: Added `card_id` to `DgClassChargeCard` interface, added `updateDgClassChargeCardAction`, tightened `updateDgClassChargeAction` to rate-only fields
  - C: Full rewrite of `_dg-class-charges-modal.tsx` with 3 modes (new, edit-rate, edit-card), exported `DgClassChargeModalSeed` and `DgClassChargeModalPayload` types, badge helpers for edit-rate header
  - D: Full rewrite of `_dg-class-charges-table.tsx` — `buildCardSeed` helper, Info button for edit-card, INTL before DOM badges, preserved `dgClassBadge`/`dgClassFilter`/`FlaskConical`, updated `onAction` signature to `(seed, mode)`, modal wired with payload dispatch
- **Files Modified:**
  - `af-server/routers/pricing/dg_class_charges.py`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/app/(platform)/pricing/dg-class-charges/_dg-class-charges-modal.tsx`
  - `af-platform/src/app/(platform)/pricing/dg-class-charges/_dg-class-charges-table.tsx`
- **Notes:** Final module in the three-module frontend rewrite series (customs v6.70, local charges v6.71, DG class v6.72). All py_compile and ESLint checks passed.

### [2026-03-14 22:45 UTC] — v6.71: Local Charges Frontend Rewrite (Two-Tier Schema)
- **Status:** Completed
- **Tasks:**
  - A: Added `card_id` to local_charges.py `/cards` response
  - B: Added `card_id` to `LocalChargeCard` interface, added `updateLocalChargeCardAction`, tightened `updateLocalChargeAction` to rate-only fields
  - C: Full rewrite of `_local-charges-modal.tsx` with 3 modes (new, edit-rate, edit-card), exported `LocalChargeModalSeed` and `LocalChargeModalPayload` types, added container_size/container_type/dg_class_code fields in edit-card mode
  - D: Full rewrite of `_local-charges-table.tsx` — `buildCardSeed` helper, Info button for edit-card, INTL/DOM badges (INTL before DOM), DG class badge, updated `onAction` signature to `(seed, mode)`, updated modal JSX to use `LocalChargesModal` with payload pattern
- **Files Modified:**
  - `af-server/routers/pricing/local_charges.py`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-modal.tsx`
  - `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-table.tsx`
- **Notes:** Mirrors v6.70 customs pattern. All py_compile and ESLint checks passed.
