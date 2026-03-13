## Prompt Log — v6.41 to v6.50

### [2026-03-13 16:00 UTC] — v6.50: is_international Flag: Migration + Backend
- **Status:** Completed
- **Tasks:**
  1. Created migration `051_is_international.sql` — adds `is_international BOOLEAN NOT NULL DEFAULT TRUE` to both `local_charges` and `dg_class_charges`, backfills domestic rows to `FALSE`.
  2. Updated `local_charges.py` — added `is_international` to models, `_SELECT`, `_row_to_dict` (r[20]), card_key, card result dict, INSERT, uniqueness check, close_previous WHERE, and field_map.
  3. Updated `dg_class_charges.py` — identical changes: models, `_SELECT`, `_row_to_dict` (r[19]), card_key, card result dict, INSERT, uniqueness check, and field_map.
  4. Updated `quotations.py` — `_load_shipment_data` now computes `is_domestic_shipment` by comparing origin/dest port countries. `_resolve_local_charges` and `_resolve_dg_class_charges` both filter by `is_international`/`is_domestic` flags based on shipment type.
- **Files Modified:** `af-server/migrations/051_is_international.sql` (new), `af-server/routers/pricing/local_charges.py`, `af-server/routers/pricing/dg_class_charges.py`, `af-server/routers/quotations.py`
- **Notes:** py_compile passes for all three files. No frontend changes.

### [2026-03-13 15:30 UTC] — v6.49: DG Class Charges: Clickable Time-Series Cells
- **Status:** Completed
- **Tasks:**
  1. Updated `_dg-class-charges-modal.tsx` — added `overrideEffectiveFrom` prop, used in new-rate mode to override default effective_from date.
  2. Updated `_dg-class-charges-table.tsx` — added `overrideEffectiveFrom` state, extended `onAction` signature with optional override param. Cells with data are clickable (edit mode, hover dot indicator). Empty cells are clickable (new-rate mode, hover `+` indicator, effective_from set to clicked month's first day).
- **Files Modified:** `af-platform/src/app/(platform)/pricing/dg-class-charges/_dg-class-charges-modal.tsx`, `_dg-class-charges-table.tsx`
- **Notes:** ESLint passes clean. No server changes.

### [2026-03-13 15:00 UTC] — v6.48: DG Class Charges: Frontend UI
- **Status:** Completed
- **Tasks:**
  1. Added DG Class Charge types + 5 server actions to `pricing.ts` (DgClassCharge, DgClassChargeCard, DgClassChargeTimeSeries, fetch/create/update/delete actions).
  2. Created `dg-class-charges/page.tsx` — page with FlaskConical icon, title, subtitle, passes countryCode + alertFilter.
  3. Created `_dg-class-charges-modal.tsx` — form modal with DG Class select (DG-2/DG-3), no paid_with_freight, all other fields matching local-charges modal.
  4. Created `_dg-class-charges-table.tsx` — card list with EXPORT/IMPORT grouping, time-series columns, DG class filter, DG class badge (rose/purple), alert detection, skeleton loading, empty states.
  5. Pricing nav page unchanged (no nav list — just dashboard wrapper).
- **Files Modified:** `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/dg-class-charges/page.tsx` (new), `_dg-class-charges-modal.tsx` (new), `_dg-class-charges-table.tsx` (new)
- **Notes:** ESLint passes clean. No server changes.

### [2026-03-13 14:30 UTC] — v6.46: DG Class Charges: CRUD Router
- **Status:** Completed
- **Tasks:**
  1. Created `af-server/routers/pricing/dg_class_charges.py` — full CRUD router modeled on `local_charges.py`. Differences: no `paid_with_freight`, no `close_previous`, `dg_class_code` limited to `DG-2`/`DG-3` only, adjusted `_SELECT` column order and `_row_to_dict` indexes.
  2. Registered in `af-server/routers/pricing/__init__.py` with prefix `/dg-class-charges`.
- **Files Modified:** `af-server/routers/pricing/dg_class_charges.py` (new), `af-server/routers/pricing/__init__.py`
- **Notes:** py_compile passes for both files. No changes to `main.py` needed — pricing router already mounted. Endpoints: GET /ports, GET /cards, GET /rates, GET /rates/{id}, POST /rates, PATCH /rates/{id}, DELETE /rates/{id}.

### [2026-03-13 14:00 UTC] — v6.45: DG Class Charges: Migration + Pricing Engine
- **Status:** Completed
- **Tasks:**
  1. Created migration `050_dg_class_charges.sql` — new `dg_class_charges` table with constraints for port_code, trade_direction, shipment_type, dg_class_code, container_size, container_type, charge_code, uom. Includes unique constraint and indexes.
  2. Added `_resolve_dg_class_charges` function to pricing engine — resolves DG-specific port charges (inspection, documentation, hazmat handling). Only fires for DG shipments (skips NON-DG). Exact dg_class_code match, no ALL fallback. Container matching logic mirrors `_resolve_local_charges`.
  3. Hooked `_resolve_dg_class_charges` into `calculate_quotation` as step D2, called for both EXPORT and IMPORT directions.
- **Files Modified:** `af-server/migrations/050_dg_class_charges.sql` (new), `af-server/routers/quotations.py`
- **Notes:** py_compile passes. No frontend changes. Part A of two-part change; Part B (v6.46) will add the CRUD router. Migration to be applied to prod separately by Calvin.

### [2026-03-13 13:30 UTC] — v6.44: Local Charges: DG Class Dimension — Router + API
- **Status:** Completed
- **Tasks:**
  1. Added `_VALID_DG_CLASS_CODES` constant.
  2. Added `dg_class_code` field to `LocalChargeCreate` (default `'NON-DG'`) and `LocalChargeUpdate` models.
  3. Updated `_SELECT` to include `dg_class_code` column, updated `_row_to_dict` to map `r[19]`.
  4. Updated `list_local_charge_cards` grouping key and card output to include `dg_class_code`.
  5. Added `dg_class_code` validation in `create_local_charge`, updated uniqueness check, INSERT, and close_previous queries with `dg_class_code` filter.
  6. Added `dg_class_code` to `field_map` and validation in `update_local_charge`.
- **Files Modified:** `af-server/routers/pricing/local_charges.py`
- **Notes:** py_compile passes. Part B of two-part change (Part A was v6.43 migration + pricing engine).

### [2026-03-13 13:00 UTC] — v6.43: Local Charges: DG Class Dimension — Migration + Pricing Engine
- **Status:** Completed
- **Tasks:**
  1. Created migration `049_local_charges_dg.sql` — adds `dg_class_code VARCHAR(10)` column with CHECK constraint (`NON-DG`, `DG-2`, `DG-3`, `ALL`). Backfills non-THC rows to `'ALL'`, THC rows default to `'NON-DG'`. Recreates `lc_unique` constraint including new column.
  2. Updated `_resolve_local_charges` — added `dg_class_code IN (:dg, 'ALL')` filter and `CASE WHEN dg_class_code = :dg THEN 0 ELSE 1 END` ORDER BY for specificity preference. Dedup key unchanged (excludes dg_class_code so exact DG match wins).
- **Files Modified:** `af-server/migrations/049_local_charges_dg.sql` (new), `af-server/routers/quotations.py`
- **Notes:** py_compile passes. Migration to be applied to prod separately by Calvin. Part A of two-part change; Part B (v6.44) will update local_charges.py router.

### [2026-03-13 12:30 UTC] — v6.42: Local Charges: Container Size Normalisation Fix
- **Status:** Completed
- **Tasks:**
  1. `_resolve_local_charges` — normalise container_size in FCL CONTAINER loop: `'20GP'` → `'20'`, `'40HC'` → `'40'`. Infers container_type from suffix if not explicitly set. local_charges only stores `'20'`/`'40'`/`'ALL'`.
  2. `_resolve_haulage` — normalise container_size: strip `'GP'` suffix only (`'20GP'` → `'20'`, `'40GP'` → `'40'`). `'40HC'` preserved since haulage distinguishes HC.
  3. `_resolve_fcl_freight` — normalise container_size: strip `'GP'`/`'RF'` suffix, keep `'40HC'` as-is. Infer container_type from suffix when not set.
- **Files Modified:** `af-server/routers/quotations.py`
- **Notes:** py_compile passes. No frontend changes. No migration.

### [2026-03-13 12:00 UTC] — v6.41: Pricing Engine: Local Charges + Customs Filtering Fix
- **Status:** Completed
- **Tasks:**
  1. Replaced `_resolve_local_charges` — FCL + `uom = CONTAINER` now sums matching container quantities and skips rows with no match (instead of defaulting qty=1). LCL/AIR branches now include explicit `else: qty = 1.0` fallthrough. Uses `qty = None` sentinel to skip non-matching rows.
  2. Replaced `_resolve_customs` — added `shipment_type` to SELECT, ORDER BY now prefers exact `shipment_type` match over `ALL` via CASE expression. Deduplication by `charge_code` keeps only the most specific row.
- **Files Modified:** `af-server/routers/quotations.py`
- **Notes:** py_compile passes. No frontend changes. No migration.
