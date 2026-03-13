## Prompt Log — v6.61 to v6.70

### [2026-03-14 21:30 UTC] — v6.70: Customs Frontend Rewrite (Two-Tier Schema)
- **Status:** Completed
- **Tasks:**
  1. A: Added `card_id` to `/cards` response in `customs.py`.
  2. B1: Added `is_international` to `CustomsRate` interface.
  3. B2: Added `card_id` and `is_international` to `CustomsRateCard` interface.
  4. B3: Added `updateCustomsCardAction` for PATCH /cards/{cardId}.
  5. B4: Narrowed `updateCustomsRateAction` to rate-only fields.
  6. C: Full rewrite of `_customs-modal.tsx` — 3 modes (`new`, `edit-rate`, `edit-card`), exported `CustomsModalSeed` and `CustomsModalPayload` types, card identity header in edit-rate mode, separate card field form in edit-card mode.
  7. D: Full rewrite of `_customs-table.tsx` — new `buildCardSeed` helper, 3-mode `onAction` prop, Info button for edit-card, INTL/DOM badges, updated modal JSX with payload dispatch.
- **Files Modified:** `af-server/routers/pricing/customs.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/customs/_customs-modal.tsx` (rewrite), `af-platform/src/app/(platform)/pricing/customs/_customs-table.tsx` (rewrite)
- **Notes:** py_compile clean. ESLint clean (no new errors/warnings). `fetchCustomsRatesAction` kept in pricing.ts per prompt instructions.

### [2026-03-14 20:45 UTC] — v6.69: DG Class Charges: Two-Tier Schema Migration + Backend Rewrite
- **Status:** Completed
- **Tasks:**
  1. A: Created `058_dg_class_charges_two_tier.sql` — 7-step migration: creates `dg_class_charge_cards` table, backfills, adds `rate_card_id` FK to `dg_class_charges`, drops card-identity columns, replaces unique constraint.
  2. B: Full rewrite of `dg_class_charges.py` — new Pydantic models (`DgClassChargeCardUpdate`, `DgClassChargeCreate`, `DgClassChargeRateUpdate`), helpers (`_card_to_dict`, `_rate_to_dict`, `_build_card_key`), 8 endpoints on two-tier schema. Added `close_previous` logic (was missing before).
  3. C: Updated `_resolve_dg_class_charges` in `quotations.py` — rewrote query to JOIN `dg_class_charge_cards` + `dg_class_charges`.
- **Files Modified:** `af-server/migrations/058_dg_class_charges_two_tier.sql` (new), `af-server/routers/pricing/dg_class_charges.py` (rewrite), `af-server/routers/quotations.py`
- **Notes:** py_compile clean. No BEGIN/COMMIT in migration. 9-part `rate_card_key`. PATCH /cards/{card_id} rebuilds key on key-forming field changes. `close_previous` added for consistency with customs and local charges. Frontend rewrite deferred to follow-on prompt.

### [2026-03-14 20:15 UTC] — v6.68: Customs is_international Fix + Local Charges Two-Tier Migration
- **Status:** Completed
- **Tasks:**
  1. A1: Created `056_customs_is_international.sql` — adds `is_international` column to `customs_rate_cards`, backfills (domestic→false), rebuilds 6-part `rate_card_key`, updates UNIQUE constraint.
  2. A2: Updated `customs.py` — `_build_card_key` now 6-part, `_card_to_dict`/`_CARD_SELECT` include `is_international`, `CustomsCardUpdate`/`CustomsRateCreate` models updated, POST/PATCH/GET endpoints updated with `is_international` support.
  3. A3: Updated `_resolve_customs` in `quotations.py` — added `is_international`/`is_domestic` filter matching local charges pattern.
  4. B1: Created `057_local_charges_two_tier.sql` — 7-step migration: creates `local_charge_cards` table, backfills, adds `rate_card_id` FK, drops card-identity + `paid_with_freight` + `is_active` columns, replaces unique constraint.
  5. B2: Full rewrite of `local_charges.py` — new Pydantic models (`LocalChargeCardUpdate`, `LocalChargeCreate`, `LocalChargeRateUpdate`), helpers (`_card_to_dict`, `_rate_to_dict`, `_build_card_key`), 8 endpoints on two-tier schema (GET /ports, GET /cards, GET /rates/{id}, POST /rates, PATCH /cards/{id}, PATCH /rates/{id}, DELETE /rates/{id}, DELETE /rates/card/{key}).
  6. B3: Updated `_resolve_local_charges` in `quotations.py` — rewrote query to JOIN `local_charge_cards` + `local_charges`.
- **Files Modified:** `af-server/migrations/056_customs_is_international.sql` (new), `af-server/migrations/057_local_charges_two_tier.sql` (new), `af-server/routers/pricing/customs.py`, `af-server/routers/pricing/local_charges.py` (rewrite), `af-server/routers/quotations.py`
- **Notes:** py_compile clean. No BEGIN/COMMIT in either migration. `paid_with_freight` not present in rewritten files. Both PATCH /cards endpoints rebuild `rate_card_key` on key-forming field changes. Frontend rewrites deferred to follow-on prompts.

### [2026-03-14 19:30 UTC] — v6.67: Customs: Two-Tier Schema Migration + Backend Rewrite
- **Status:** Completed
- **Tasks:**
  1. A: Created `055_customs_two_tier.sql` — 7-step migration: creates `customs_rate_cards` table, backfills from existing data, adds `rate_card_id` FK to `customs_rates`, populates FK, makes NOT NULL, drops redundant card-identity columns, replaces unique constraint, adds indexes.
  2. B: Full rewrite of `routers/pricing/customs.py` — new Pydantic models (`CustomsCardUpdate`, `CustomsRateCreate`, `CustomsRateUpdate`), helpers (`_card_to_dict`, `_rate_to_dict`, `_build_card_key`), 8 endpoints operating on two-tier schema (GET /ports, GET /cards, GET /rates/{id}, POST /rates with find-or-create card, PATCH /cards/{id} with rate_card_key rebuild, PATCH /rates/{id}, DELETE /rates/{id}, DELETE /rates/card/{key}).
  3. Updated `_resolve_customs` in `routers/quotations.py` — rewrote query to JOIN `customs_rate_cards` + `customs_rates` since card-identity columns no longer exist on `customs_rates`.
- **Files Modified:** `af-server/migrations/055_customs_two_tier.sql` (new), `af-server/routers/pricing/customs.py` (rewrite), `af-server/routers/quotations.py`
- **Notes:** py_compile clean. Migration has no BEGIN/COMMIT. PATCH /cards/{card_id} rebuilds rate_card_key when key-forming fields change. Frontend rewrite deferred to follow-on prompt.

### [2026-03-14 18:00 UTC] — v6.66: Pricing Rate Cards: Delete Card, Clickable Cells, Two-Tier Update Fix
- **Status:** Completed
- **Tasks:**
  1. **Customs modal**: Added delete button with 2-step confirmation UI, saveError display, `overrideEffectiveFrom` prop.
  2. **Customs table**: Added clickable time-series cells (data → edit, empty → new-rate with date override), `overrideEffectiveFrom` state, `deleteCustomsRateAction` wiring, `onDelete` passed to modal.
  3. **Local charges modal**: Added `overrideEffectiveFrom` prop + wiring in useEffect.
  4. **Local charges table**: Added clickable time-series cells, `overrideEffectiveFrom` state, updated `onAction` signature.
  5. **Delete card (all 3 modules)**: Added `DELETE /rates/card/{card_key}` backend endpoints for customs, local charges, and DG class charges. Added `deleteCustomsCardAction`, `deleteLocalChargeCardAction`, `deleteDgClassChargeCardAction` server actions. Added trash icon button + inline confirmation overlay to card identity panel in all 3 tables.
  6. **Two-tier update fix (customs + local charges)**: Rewrote PATCH endpoints to separate card-level fields (propagate to ALL rows in card) from rate-level fields (single row only) — matching the existing DG class charges pattern. Prevents editing card-level fields from splitting rows into new cards. FCL/LCL/Air not affected (card + rate tables are naturally separate).
- **Files Modified:** `af-server/routers/pricing/customs.py`, `af-server/routers/pricing/local_charges.py`, `af-server/routers/pricing/dg_class_charges.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/customs/_customs-modal.tsx`, `af-platform/src/app/(platform)/pricing/customs/_customs-table.tsx`, `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-modal.tsx`, `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-table.tsx`, `af-platform/src/app/(platform)/pricing/dg-class-charges/_dg-class-charges-table.tsx`
- **Notes:** ESLint clean, py_compile clean. Card-level fields: port_code, trade_direction, shipment_type, charge_code, description, uom, currency, is_domestic (+ container_size, container_type, dg_class_code, is_international for LC/DG). Rate-level fields: price, cost, effective_from, effective_to, is_active.

### [2026-03-14 02:15 UTC] — v6.65: Edit Scope Modal: Quotation Detail Page
- **Status:** Completed
- **Tasks:**
  1. A: Added `updateQuotationScopeSnapshotAction` server action in `quotations.ts`.
  2. B: Added `PATCH /quotations/{ref}/scope-snapshot` backend endpoint with `ScopeSnapshotUpdate` Pydantic model.
  3. C: Created `EditScopeModal.tsx` — modal with scope toggle rows (ASSIGNED/TRACKED/IGNORED per key), Telex Release checkbox, save logic (updates shipment scope + quotation snapshot + TLX release).
  4. D: Wired modal into `_components.tsx` — imported `EditScopeModal`, rendered with `editScopeOpen` state, `onSaved` callback updates quotation scope + tlxRelease + scopeChanged.
  5. D3: Added `incoterm` and `transaction_type` to `Quotation` interface, `_serialise_quotation`, and all 3 quotation SELECT queries (joined from `shipment_details`). Also added missing `q.tlx_release` to the GET single quotation query.
  6. E: Consolidated Tax (SST) into totals bar — removed separate subtotal block above bar, added Tax (SST) between Total Price and Total Cost (shown when `total_tax > 0` in both AFU and customer views).
  7. Removed unused `handleTlxToggle` and `setTlxReleaseAction` import from `_components.tsx` (user had already moved TLX to scope card label).
- **Files Modified:** `af-server/routers/quotations.py`, `af-platform/src/app/actions/quotations.ts`, `af-platform/src/components/quotations/EditScopeModal.tsx` (new), `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`
- **Notes:** ESLint clean, py_compile clean. User had already stubbed `editScopeOpen` state and Edit Scope button in scope card, and moved TLX from header card to scope card as plain label.

### [2026-03-14 01:30 UTC] — v6.64: Tax + TLX Toggle: Frontend + Freight Scope Gating
- **Status:** Completed
- **Tasks:**
  1. A: Backend freight scope gating — wrapped FCL/LCL/AIR freight resolution in `scope.get("freight") == "ASSIGNED"` gate in `calculate_quotation`.
  2. B1: Added `tlx_release?: boolean` to `Quotation` interface.
  3. B2: Added `tax_code`, `tax_rate`, `tax_amount` to `QuotationLineItem` interface.
  4. B3: Added `total_tax: number` to `LineItemTotals` interface.
  5. B4: Added `setTlxReleaseAction` server action.
  6. B5: Added `total_tax` computation to `list_line_items` backend endpoint totals response.
  7. C1: Added `setTlxReleaseAction` import to `_components.tsx`.
  8. C2: Added `tlxRelease` state, initialised from quotation data.
  9. C3: Added `handleTlxToggle` handler — calls action, sets `scopeChanged` on success.
  10. C4: Telex Release checkbox in header card (AFU only, below meta fields).
  11. C5: Tax column shows `X%` badge on taxable line items, `—` on exempt (GroupRows + Other Charges data rows).
  12. C6: Tax subtotal row above totals bar (visible when `total_tax > 0`).
  13. D: Added `freight` scope key — updated `ScopeFlags` interface, `INCOTERM_TASK_RULES` (all incoterms), `getScopeLabel` (both files), `handleSubmit` scopePayload.
- **Files Modified:** `af-server/routers/quotations.py`, `af-platform/src/app/actions/quotations.ts`, `af-platform/src/app/actions/ground-transport.ts`, `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`, `af-platform/src/components/shipments/CreateQuotationModal.tsx`
- **Notes:** ESLint clean, py_compile clean. Freight scope placement in INCOTERM_TASK_RULES: EXPORT incoterms (CFR/CIF/CNF/CPT/CIP) include freight; IMPORT incoterms (FOB/FCA/EXW) include freight on buyer side; DAP/DPU/DDP include freight on both sides.

### [2026-03-14 00:45 UTC] — v6.63: Tax Calculation + TLX Toggle: Backend
- **Status:** Completed
- **Tasks:**
  1. Created `052_tax_rules.sql` — tax_rules table with country-level tax rules, indexes, trigger, and MY-SST seed row (6% on all local operations, exempt for ocean/air freight).
  2. Created `053_line_items_tax.sql` — added `tax_code`, `tax_rate`, `tax_amount` columns to quotation_line_items.
  3. Created `054_quotation_tlx_release.sql` — added `tlx_release` boolean to quotations (default FALSE).
  4. Added `_compute_effective_price` helper for tax computation.
  5. Added `_apply_tax` helper — resolves country-level tax rules per component_type direction (export→origin, import→dest, other→origin, freight→exempt). Stamps tax_code/rate/amount on items in place.
  6. Updated `_insert_line_item` with tax_code, tax_rate, tax_amount columns.
  7. Updated `_LINE_ITEM_SELECT` and `_serialise_line_item` to include tax columns (indices 21-23).
  8. Added `tlx_release` gating in `_resolve_local_charges` — skips LC-TLX charge unless `tlx_release=True`.
  9. Updated `calculate_quotation` to load `tlx_release` from quotation row and pass to EXPORT local charges call. Added `_apply_tax` call after component resolution.
  10. Added `PATCH /quotations/{ref}/tlx-release` endpoint — toggles flag and sets `scope_changed=TRUE`.
  11. Added `tlx_release` to `_serialise_quotation` (index 13) and all 3 quotation SELECT queries.
- **Files Modified:** `af-server/migrations/052_tax_rules.sql`, `af-server/migrations/053_line_items_tax.sql`, `af-server/migrations/054_quotation_tlx_release.sql`, `af-server/routers/quotations.py`
- **Notes:** py_compile clean. No frontend changes (handled in v6.64). Manual override items get tax_rate=0 from column default — manual item tax to be addressed in a future prompt.

### [2026-03-14 00:15 UTC] — v6.62: Quotation Detail + Geography Areas: Table Cleanup + View Toggle Move + Tax Column
- **Status:** Completed
- **Tasks:**
  1. A1: Moved customer/AFU view toggle from header card to back-link row (flex row with toggle on right). Header card right side now only has info block + Calculate Pricing button.
  2. A2: Removed Code column from table header, GroupRows data/edit rows, Other Charges data/edit rows. Updated colSpan on group headers.
  3. A3: Added `UOM_DISPLAY` map + `fmtUom()` function. All data row UOM cells now use abbreviated display (SHIPMENT→SHIP, CONTAINER→CTR). Select dropdowns unchanged.
  4. A4: Added Tax column (placeholder "—") after Eff. Price in table header, GroupRows data/edit rows, Other Charges data/edit rows, and both group headers (GroupRows + Other Charges). Column visible in both AFU and customer views.
  5. B1: Added `countryMap` state to AreasTab, fetches countries in `load()`. Country filter options now show `CC — Country Name` instead of just the code.
- **Files Modified:** `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`, `af-platform/src/app/(platform)/geography/_components.tsx`
- **Notes:** ESLint clean. No backend changes. Net column count unchanged (Code removed −1, Tax added +1). AFU group header colSpan 6→5, customer unchanged at 4.

### [2026-03-13 23:45 UTC] — v6.61: Geography: Remove Cities Tab, Fix Areas Filters, Add Area Text Search
- **Status:** Completed
- **Tasks:**
  1. Removed `'Cities'` from `TABS` array in `page.tsx`, removed `CitiesTab` import, removed Cities render line, updated subtitle text.
  2. Deleted `CitiesTab` and `CityFormModal` components entirely from `_components.tsx`. Removed `fetchCitiesAction`, `createCityAction`, `updateCityAction` from imports. Removed `City` type import (not used elsewhere). Kept `Port` type (still used by PortsTab).
  3. Rewrote `AreasTab`: removed `filterPort`/`ports` state and port fetching. Added `filterText` state. Derived `countryOptions` from `state_code` prefix instead of ports. Added `stateOptions` scoped to selected country. Added `displayed` filtered list with country/state/text filters. Replaced port combobox with text search input.
  4. Rewrote `AreaFormModal`: removed `ports` prop, `portUnCode` state, Port `<select>` field. Removed `port_un_code` from create/update payloads. Updated validation to only require code and name.
- **Files Modified:** `af-platform/src/app/(platform)/geography/page.tsx`, `af-platform/src/app/(platform)/geography/_components.tsx`
- **Notes:** ESLint clean. No backend changes. `fetchGeoPortsAction` kept in imports (used by PortsTab).
