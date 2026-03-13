## Prompt Log — v6.51 to v6.60

### [2026-03-13 23:30 UTC] — v6.60: Quotation Detail: UOM Dropdown + Button Layout + Customer/AFU View Toggle
- **Status:** Completed
- **Tasks:**
  1. Updated `page.tsx` to async server component — calls `verifySessionAndRole` and passes `accountType` prop to `QuotationDetail`.
  2. Added `customerView` state toggle (AFU defaults to AFU view, AFC always customer view). Toggle pill button in header card for AFU users.
  3. Customer view hides Cost/unit, Eff. Cost, Margin, and Actions columns from table header, data rows, edit rows, group headers, and totals bar. GroupRows and Other Charges group headers use `colSpan={4}` + 2 in customer view vs `colSpan={6}` + 4 in AFU view.
  4. UOM changed from free-text input to `<select>` dropdown with `UOM_OPTIONS` constant (SHIPMENT, CONTAINER, CBM, KG, etc.) in both manual item form and Other Charges edit row. Added `uom?: string` to `LineItemUpdatePayload`.
  5. Moved "+ Add Manual Item" button into totals bar (left side, AFU only). Added standalone fallback when `lineItems.length === 0`. Form renders in standalone div when no table, or in `<tbody>` when table exists.
  6. `startEdit` now includes `uom` in `editPayload`.
- **Files Modified:** `af-platform/src/app/(platform)/quotations/[ref]/page.tsx`, `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`, `af-platform/src/app/actions/quotations.ts`
- **Notes:** ESLint clean. No backend changes. `page.tsx` is now async server component with auth.

### [2026-03-13 23:00 UTC] — v6.59: Quotation Detail Page: Info Card + Subtotal Alignment + Other Charges Behaviour
- **Status:** Completed
- **Tasks:**
  1. Backend: Enriched `_serialise_quotation` with `company_name` (row[11]) and `order_type` (row[12]). Updated SELECT in `list_quotations` (both branches) and `get_quotation` to LEFT JOIN orders, companies, shipment_details.
  2. Frontend types: Added `company_name?: string | null` and `order_type?: string | null` to `Quotation` interface.
  3. Frontend: Scope column now only shows ASSIGNED items as plain text labels (no badges). Removed `SCOPE_BADGE` constant.
  4. Frontend: Transport labels now use `getTransportLabel()` — shows "First Mile Haulage" for FCL, "First Mile Transport" for LCL/AIR.
  5. Frontend: Added `company_name` below shipment link in header card.
  6. Frontend: Group header rows in `GroupRows` now use multi-cell layout (colSpan=6 + 4 individual cells) so subtotals align with Eff. Price / Eff. Cost / Margin columns. Removed `currency` prop from GroupRows.
  7. Frontend: Other Charges group — hidden when no items and form not open. Group header uses same multi-cell layout with subtotals. Removed inline "Add Item" button from header. Added standalone "+ Add Manual Item" button below table. Removed empty state row.
  8. Fixed `fetchAreasAction` URL: changed `/api/v2/areas` to `/api/v2/geography/areas` (geography router is mounted at `/api/v2/geography`).
- **Files Modified:** `af-server/routers/quotations.py`, `af-platform/src/app/actions/quotations.ts`, `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`
- **Notes:** ESLint clean, py_compile clean. No changes to `page.tsx`.

### [2026-03-13 22:30 UTC] — v6.58: Quotation Ref Format + Scope-Gated Warnings + Cargo Ready Date as ref_date
- **Status:** Completed
- **Tasks:**
  1. Changed quotation ref format from `AFQ-00000001` (sequence-based) to `{shipment_id}-Q{revision}` (e.g. `AF-003859-Q1`). Removed `SELECT nextval('quotation_ref_seq')` call.
  2. Replaced `ref_date = date.today()` with `shipment["cargo_ready_date"] or date.today()` in `calculate_quotation` — pricing engine now uses cargo ready date when available.
  3. Added scope-gating for local charges and DG class charges: EXPORT direction only called when `first_mile` or `export_clearance` is ASSIGNED; IMPORT direction only called when `last_mile` or `import_clearance` is ASSIGNED. Eliminates spurious "No local charges found" warnings on FOB shipments.
- **Files Modified:** `af-server/routers/quotations.py`
- **Notes:** py_compile clean. No frontend changes. No migration needed — `quotation_ref_seq` left in DB but no longer called.

### [2026-03-13 22:15 UTC] — v6.57: Quotation Detail Page: UX Overhaul
- **Status:** Completed
- **Tasks:**
  1. Backend: Added `ids` query param to `GET /areas` endpoint in `geography.py` — bulk area lookup with `bindparam("ids", expanding=True)`, returns `area_id`, `area_name`, `state_code`, `state_name` via JOIN on `states`.
  2. Server Action: Added `AreaInfo` interface + `fetchAreasAction` to `quotations.ts` — calls `GET /api/v2/areas?ids=` with standard auth pattern.
  3. Frontend: Merged Scope Snapshot + Transport Details cards into single two-column info card. Transport column resolves `area_id` to `area_name, state_name` via `areaMap` state populated by `fetchAreasAction` in `useEffect`. Vehicle type formatted with title case.
  4. Frontend: Made `GroupRows` collapsible with chevron toggle and group subtotals (price total + margin %). Added `currency` prop, `isOpen` state. Indented data rows with `pl-8 pr-3`.
  5. Frontend: Replaced `+ Add Manual Item` button and `showManualForm` block with permanent "Other Charges" group at bottom of table. Group header has `+ Add Item` button. Inline form renders inside `<tbody>` when `showOtherForm` is true. `handleAddManual` always sets `component_type: 'other'`.
  6. Removed `showManualForm` state, `COMPONENT_TYPE_OPTIONS` array, `X` icon import. Removed old manual form block below table.
- **Files Modified:** `af-server/routers/geography.py`, `af-platform/src/app/actions/quotations.ts`, `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`
- **Notes:** ESLint clean, py_compile clean. No changes to `page.tsx`.

### [2026-03-13 21:30 UTC] — v6.56: Port Combobox in Pricing Modals
- **Status:** Completed
- **Tasks:**
  1. Replaced plain text `Port Code` input with `PortCombobox` in local-charges, dg-class-charges, and customs modals.
  2. Added `portOptions` prop to all three modal interfaces (with default `[]`).
  3. Changed `<label>` wrapper to `<div>` for the port field in each modal (combobox has its own click handling).
  4. Added `modalPortOptions` useMemo in all three parent table components, built from existing `portsMap`.
  5. Passed `portOptions={modalPortOptions}` to each modal instance.
- **Files Modified:** `_local-charges-modal.tsx`, `_dg-class-charges-modal.tsx`, `_customs-modal.tsx`, `_local-charges-table.tsx`, `_dg-class-charges-table.tsx`, `_customs-table.tsx`
- **Notes:** All three tables already fetched ports on mount (`fetchPortsAction` → `portsMap`). No new fetches added. ESLint clean.

### [2026-03-13 21:00 UTC] — v6.55: DG Classification on Shipment Orders
- **Status:** Completed
- **Tasks:**
  1. Backend: Added `cargo_dg_class_code` to `CreateManualShipmentRequest` with validation (DG-2/DG-3). Cargo JSONB now writes `dg_class_code` instead of `dg_class`, derives `is_dg` from it.
  2. Backend: Rewrote `PatchCargoRequest` to accept `dg_class_code: Optional[str]` instead of `is_dg: bool`. Derives `is_dg` automatically.
  3. Backend: Updated `_load_shipment_data` in quotations.py — reads `dg_class_code` first, falls back to legacy `dg_class` key. Logs warning if `is_dg=True` but no class code.
  4. Frontend: Replaced boolean DG checkbox in `StepCargo.tsx` with 3-option segmented selector (Not DG / DG Class 2 / DG Class 3). Removed "add later" amber box, added "charges will be priced" badge.
  5. Frontend: Updated `CreateShipmentModal.tsx` — `cargoDg: boolean` → `cargoDgClass: string | null`. Payload sends both `cargo_is_dg` and `cargo_dg_class_code`.
  6. Frontend: Updated `StepReview.tsx` props and display to show DG class name.
  7. Frontend: Updated `shipments-write.ts` — `CreateShipmentOrderPayload` type + `patchShipmentCargoAction` signature (now `dg_class_code` instead of `is_dg`).
  8. Frontend: Replaced DG checkbox on shipment detail page (`[id]/page.tsx`) with 3-option selector matching create flow.
  9. Frontend: Added `dg_class_code` to `Cargo` interface in `lib/types.ts`.
- **Files Modified:** `af-server/routers/shipments/core.py`, `af-server/routers/quotations.py`, `af-platform/src/components/shipments/_create-shipment/StepCargo.tsx`, `af-platform/src/components/shipments/_create-shipment/StepReview.tsx`, `af-platform/src/components/shipments/CreateShipmentModal.tsx`, `af-platform/src/app/actions/shipments-write.ts`, `af-platform/src/app/(platform)/shipments/[id]/page.tsx`, `af-platform/src/lib/types.ts`
- **Notes:** No migration needed — cargo is JSONB. Backward compat maintained: `is_dg` still written for legacy reads, `_load_shipment_data` falls back to old `dg_class` key. ESLint clean, Python compile clean.

### [2026-03-13 20:00 UTC] — v6.54: DG Class Charges Card-Level Edit Fix + Effective To Alignment
- **Status:** Completed
- **Tasks:**
  1. Fixed DG class charges PATCH endpoint — editing card-level fields (UOM, is_international, etc.) now updates ALL rows in the card, not just one row. Previously, changing a card-level field on one rate row caused the card to split (one row with new values, siblings with old values = new card appearing on display).
  2. Rewrote `update_dg_class_charge` to separate card-level fields (port_code, trade_direction, shipment_type, container_size, container_type, dg_class_code, charge_code, description, uom, currency, is_domestic, is_international) from rate-level fields (price, cost, effective_from, effective_to, is_active). Card-level changes apply to all rows matched by old card identity; rate-level changes apply only to the specific row.
  3. Fixed Effective To date input misalignment in 3 modals — "Effective From" label was a bare `<span>` while "Effective To" was wrapped in a `<div class="flex items-center justify-between">` (for the "Remove end date" button), causing vertical misalignment. Wrapped "Effective From" in the same `<div>` structure.
- **Files Modified:** `af-server/routers/pricing/dg_class_charges.py`, `af-platform/src/app/(platform)/pricing/dg-class-charges/_dg-class-charges-modal.tsx`, `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-modal.tsx`, `af-platform/src/app/(platform)/pricing/customs/_customs-modal.tsx`
- **Notes:** Other modals (_rate-modal.tsx, _depot-gate-fee-modal.tsx) already had aligned labels and were not affected.

### [2026-03-13 18:30 UTC] — v6.53: Deep Investigation: Phantom Row Creation on Rate Card Edit
- **Status:** Completed
- **Tasks:**
  1. Full stack trace from button click to DB write across DG class charges, local charges, and customs modules.
  2. Root cause identified: `latest?.rate_id ?? 0` produces falsy `0` when no time-series exists, causing `!editRateId` guards to throw (DG/local) or fall through to CREATE instead of PATCH (customs). Fixed by changing `?? 0` to `?? null` across all three tables.
  3. Changed `!editRateId` truthiness checks to `editRateId === null` in DG and local charges tables. Changed `editRateId && modalMode === 'edit'` to `editRateId !== null && modalMode === 'edit'` in customs table.
  4. Updated `onAction` callback type signatures from `rateId: number` to `rateId: number | null` in all three table card-list components.
  5. Fixed `id: rateId` in editRate object construction to `id: rateId ?? 0` (id is only used for modal hydration, never sent to server).
- **Files Modified:** `_dg-class-charges-table.tsx`, `_local-charges-table.tsx`, `_customs-table.tsx`
- **Notes:** ESLint passes clean on all 3 files. The customs table had the most dangerous variant — `editRateId && ...` used truthiness, silently falling through to CREATE when `editRateId` was `0`. No backend changes needed.

### [2026-03-13 17:45 UTC] — v6.52: is_international: Frontend (Modals + Types)
- **Status:** Completed
- **Tasks:**
  1. Added `is_international: boolean` to `LocalCharge`, `LocalChargeCard`, `DgClassCharge`, `DgClassChargeCard` interfaces in `pricing.ts`.
  2. Added `isInternational` state to `_local-charges-modal.tsx` — initialises to `true`, hydrates from `editRate.is_international`, resets to `true` on close. JSX replaced single `Is Domestic` checkbox with inline pair: International + Domestic.
  3. Updated `_local-charges-table.tsx` editRate construction to pass `is_international`.
  4. Applied identical changes to `_dg-class-charges-modal.tsx` and `_dg-class-charges-table.tsx`.
- **Files Modified:** `af-platform/src/app/actions/pricing.ts`, `_local-charges-modal.tsx`, `_local-charges-table.tsx`, `_dg-class-charges-modal.tsx`, `_dg-class-charges-table.tsx`
- **Notes:** ESLint passes clean. No backend changes — backend completed in v6.50.

### [2026-03-13 17:15 UTC] — v6.51: Local Charges: Modal Fixes + paid_with_freight Removal
- **Status:** Completed
- **Tasks:**
  1. Fixed Effective To alignment in `_local-charges-modal.tsx` — changed bare `<div>` to `<label>` wrapper.
  2. Fixed Effective To alignment in `_customs-modal.tsx` — same `<div>` → `<label>` fix.
  3. Removed `paid_with_freight` entirely from frontend (modal state/JSX/payload, types in pricing.ts, table badges/object construction) and backend (LocalChargeCreate/Update models, _SELECT, _row_to_dict re-indexed, INSERT, field_map, cards endpoint, quotations resolver).
  4. Added DG Class dropdown to local charges modal — new `DG_CLASS_CODES` constant, state, useEffect branches, handleSubmit payload, and `<select>` in JSX (paired with Shipment Type row). Rearranged layout to 3-col row for Charge Code + UOM + Currency.
  5. Added `dg_class_code` field to `LocalCharge` and `LocalChargeCard` TypeScript interfaces.
  6. Added `dg_class_code` to table's editRate object construction.
- **Files Modified:** `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-modal.tsx`, `af-platform/src/app/(platform)/pricing/customs/_customs-modal.tsx`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-table.tsx`, `af-server/routers/pricing/local_charges.py`, `af-server/routers/quotations.py`
- **Notes:** All 5 lint/compile checks pass. Also cleaned up `_local-charges-table.tsx` PWF badge and paid_with_freight references to prevent build failures.
