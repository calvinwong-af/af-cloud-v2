# Prompt Completion Log — v5.11–v5.20

### [2026-03-08 08:00 UTC] — v5.20: PortCombobox Terminal Integration
- **Status:** Completed
- **Tasks:**
  - Task 1: Extended `PortCombobox` with `withTerminal`, `terminalValue`, `onTerminalChange` props; auto-applies default terminal on port selection and on mount; renders `TerminalSelector` inline when port has terminals
  - Task 2: Refactored `BCReview.tsx` — removed mount `useEffect` for POL terminal, removed inline `<select>` IIFEs for POL/POD terminals, replaced with `withTerminal` API on both `PortCombobox` instances
  - Task 3: Refactored `BLReview.tsx` — same as Task 2, removed inline `<select>` IIFEs for POL/POD terminals
  - Task 4: Updated `AWBReview.tsx` — added `has_terminals`/`terminals` to airPortOptions for forward-compatibility (no `withTerminal` — airports have no terminals)
  - Task 5: Refactored `StepRoute.tsx` — removed separate `<TerminalSelector>` renders, replaced with `withTerminal` API on both origin/dest `PortCombobox`; removed `TerminalSelector` import
- **Files Modified:**
  - `af-platform/src/components/shared/PortCombobox.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/BLReview.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/AWBReview.tsx`
  - `af-platform/src/components/shipments/_create-shipment/StepRoute.tsx`

---

### [2026-03-08 07:15 UTC] — v5.19: Geography Cleanup — Deprecate ports.country, Join via countries table
- **Status:** Completed
- **Tasks:**
  - Task 1: Created `migrations/015_deprecate_ports_country.sql` — backfills country_code from UN/LOCODE prefix, adds FK to countries table, adds deprecation comment on ports.country
  - Task 2: Updated `routers/geography.py` — `_load_ports()`, `get_port()`, `resolve_port()`, `confirm_port()` all now JOIN to countries table for country_name, no longer read/write ports.country
  - Task 3: Updated `routers/pricing/__init__.py` — `/pricing/countries` now queries countries table directly using LEFT(port_code, 2) derivation
  - Task 4: Updated all frontend Port interfaces and usages from `.country` to `.country_name` across 16 files
  - Task 5: Created `scripts/run_migration_015.py` — migration runner with verification
  - Ran migration: 332/371 ports now have country_code set; 39 NULL are 3-char IATA codes (expected)
- **Files Modified:**
  - `af-server/migrations/015_deprecate_ports_country.sql` (new)
  - `af-server/scripts/run_migration_015.py` (new)
  - `af-server/routers/geography.py`
  - `af-server/routers/pricing/__init__.py`
  - `af-platform/src/lib/ports.ts`
  - `af-platform/src/app/actions/geography.ts`
  - `af-platform/src/app/actions/shipments.ts`
  - `af-platform/src/app/(platform)/pricing/_components.tsx`
  - `af-platform/src/app/(platform)/geography/_components.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
  - `af-platform/src/app/(platform)/orders/shipments/page.tsx`
  - `af-platform/src/components/shipments/_create-shipment/_types.ts`
  - `af-platform/src/components/shipments/_create-shipment/StepRoute.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/AWBReview.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/BLReview.tsx`
  - `af-platform/src/components/shipments/DocumentParseModal.tsx`
  - `af-platform/src/components/shipments/BLUploadTab.tsx`
  - `af-platform/src/components/shipments/ShipmentFilesTab.tsx`
  - `af-platform/src/components/shipments/NewShipmentButton.tsx`
  - `af-platform/src/components/shipments/_bl-upload/BLManualFields.tsx`
  - `af-platform/src/components/shipments/_bl-upload/BLParseResult.tsx`

---

### [2026-03-08 06:30 UTC] — v5.18: Seed Missing Ports from Rate Cards
- **Status:** Completed
- **Tasks:**
  - Created `af-server/scripts/seed_ports_from_rate_cards.py` — scans all port codes in `fcl_rate_cards` and `lcl_rate_cards`, identifies codes missing from `ports` table, inserts with derived metadata
  - Supports `--dry-run` flag, verification step, `ON CONFLICT DO NOTHING` for idempotency
  - Dry-run returned 0 missing ports — all rate card port codes already exist in `ports` (likely seeded by prior migration/script runs)
- **Files Modified:**
  - `af-server/scripts/seed_ports_from_rate_cards.py` (new)
- **Notes:** Script is ready for future use when new rate cards are imported with ports not yet in the `ports` table

---

### [2026-03-07 17:45 UTC] — v5.17: Pricing General Text Filter
- **Status:** Completed
- **Tasks:**
  - Replaced destination `PortCombobox` (row 2) with plain text `<input>` in both FCL and LCL tabs
  - Text filter is client-side only — filters `filteredCards` via `useMemo` across destination code/name/country, container size/type, DG class, terminal
  - Removed `destFilter`/`destOptions` state and `destPort` from backend fetch calls
  - Added clear (×) button on text input
  - Count line shows "N of M rate cards" when filter narrows results
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---

### [2026-03-07 17:15 UTC] — v5.16: Shared PortCombobox + Pricing Filter Bar v2
- **Status:** Completed
- **Tasks:**
  - Task 1: Created shared `PortCombobox` in `components/shared/PortCombobox.tsx` — keyboard nav (ArrowUp/Down/Enter/Escape/Tab), sublabel support, highlight, 80-item limit, "No results" message, className override
  - Task 2: `StepRoute.tsx` — removed local `Combobox`, replaced with shared `PortCombobox`
  - Task 3: `BCReview.tsx` — removed local `PortCombobox`, imported shared, added `sublabel: p.country` to options
  - Task 4: `BLReview.tsx` — same as Task 3
  - Task 5: `AWBReview.tsx` — same as Task 3
  - Task 6: `_components.tsx` — removed `FilterCombobox` and `inputCls`, updated `ToggleSwitch` (role="switch", aria-checked, absolute positioning for thumb), two-row filter bar (Row 1: Country/Origin/Size/Toggle, Row 2: destination PortCombobox full-width with name+country sublabel), added `portsMap` from `fetchPortsAction`, origin sublabel shows port name
- **Files Modified:**
  - `af-platform/src/components/shared/PortCombobox.tsx` (new)
  - `af-platform/src/components/shipments/_create-shipment/StepRoute.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/BLReview.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/AWBReview.tsx`
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---

### [2026-03-07 16:30 UTC] — v5.15: Pricing FCL/LCL — Filter Bar Redesign
- **Status:** Completed
- **Tasks:**
  - Task 0a: Country filter changed from OR (origin OR destination) to origin-only JOIN in both `fcl.py` and `lcl.py`
  - Task 0b: Added `GET /pricing/fcl/origins` endpoint — returns distinct origin port codes filtered by country/active
  - Task 0c: Added `GET /pricing/lcl/origins` endpoint — same pattern for LCL
  - Task 0d: Added `fetchFCLOriginsAction` and `fetchLCLOriginsAction` server actions
  - Task 1: Replaced "Show inactive" checkbox with inline toggle switch component (both FCL + LCL)
  - Task 2: Origin combobox always visible, populated from `/origins` endpoint, removed `+ Origin` button and `showOriginFilter` state
  - Task 3: Table gated on origin selection — shows "Select an origin port" empty state when no origin chosen, count line only renders when origin selected
- **Files Modified:**
  - `af-server/routers/pricing/fcl.py`
  - `af-server/routers/pricing/lcl.py`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---

### [2026-03-07 UTC] — v5.14: Pricing FCL/LCL — Country Default + Origin Filter + POD Search
- **Status:** Completed
- **Tasks:**
  - Fix 1: FCL/LCL pages default to `MY` when no `?country=` param
  - Fix 2: Removed Description column from both FCL/LCL tables (colSpan updated: FCL 8, LCL 7)
  - Fix 3: Origin filter now hidden by default, revealed via `+ Origin` button, uses FilterCombobox with options derived from loaded cards, resets on country change
  - Fix 4: Destination filter changed from free-text to FilterCombobox with options from loaded cards, exact match, resets on country change
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/fcl/page.tsx`
  - `af-platform/src/app/(platform)/pricing/lcl/page.tsx`
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---

### [2026-03-07 UTC] — v5.13: Pricing Module — Sidebar Refinement + Country Selector Fixes
- **Status:** Completed
- **Tasks:**
  - Fix 1a: Removed "Dashboard" sub-item from PRICING_SUB_ITEMS (now 7 items)
  - Fix 1b: Changed pricing header from `<button>` to `<Link href="/pricing">` with separate chevron toggle (stopPropagation)
  - Fix 2: Changed country label format from `Name (XX)` to `XX — Name` with null filter, applied in all 3 components
  - Fix 3: Changed PricingDashboard default country from `''` to `'MY'`
- **Files Modified:**
  - `af-platform/src/components/shell/Sidebar.tsx`
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---

### [2026-03-07 UTC] — v5.12: Pricing Module — Backend Country Filter + Dashboard + Navigation
- **Status:** Completed
- **Tasks:**
  - Part 1a: Added `country_code` query param to `list_fcl_rate_cards` with JOIN to ports table
  - Part 1b: Added `country_code` query param to `list_lcl_rate_cards` with same JOIN pattern
  - Part 1c: Added `GET /pricing/dashboard-summary` (total_cards, last_updated, expiring_soon per mode) and `GET /pricing/countries` endpoints in `__init__.py`
  - Part 2: Refactored Sidebar SYSTEM section — pricing now has collapsible sub-nav with 8 items (3 active, 5 locked), auto-expands on `/pricing/*`, localStorage persistence
  - Part 3: Created `app/actions/pricing.ts` — 6 server actions (countries, dashboard summary, FCL/LCL rate cards list + detail)
  - Part 4: Created pricing dashboard page with country filter, card grid (7 components, 2 active + 5 locked), stats from dashboard-summary endpoint
  - Part 5: Created FCL rate cards page with country/origin/dest/container/active filters, expandable rate history rows
  - Part 6: Created LCL rate cards page with same pattern (no container filter)
- **Files Modified:**
  - `af-server/routers/pricing/__init__.py`
  - `af-server/routers/pricing/fcl.py`
  - `af-server/routers/pricing/lcl.py`
  - `af-platform/src/components/shell/Sidebar.tsx`
  - `af-platform/src/app/actions/pricing.ts` (new)
  - `af-platform/src/app/(platform)/pricing/page.tsx` (new)
  - `af-platform/src/app/(platform)/pricing/_components.tsx` (new)
  - `af-platform/src/app/(platform)/pricing/fcl/page.tsx` (new)
  - `af-platform/src/app/(platform)/pricing/lcl/page.tsx` (new)

---

### [2026-03-07 UTC] — v5.11: Port Terminals Table + Pricing Terminal Awareness
- **Status:** Completed
- **Tasks:**
  - Created `migrations/014_port_terminals.sql` — port_terminals table, seed from ports.terminals JSONB, terminal_id FK on rate card tables
  - Created `scripts/run_migration_014.py` — migration runner with verification (row counts, column checks, terminal listing)
  - Added `GET /geography/port-terminals` and `GET /geography/port-terminals/{terminal_id}` endpoints with `_terminals_cache` (10-min TTL, invalidated with port cache)
  - Added `terminal_id` to FCL models (`FCLRateCardCreate`, `FCLRateCardUpdate`), `_RATE_CARD_SELECT`, `_row_to_rate_card`, create endpoint (with port validation), update endpoint
  - Added `terminal_id` to LCL models (`LCLRateCardCreate`, `LCLRateCardUpdate`), `_RATE_CARD_SELECT`, `_row_to_rate_card`, create endpoint (with port validation), update endpoint
  - Added `_PORT_TERMINAL_MAP`, `_get_terminal_id()` to `migrate_pricing_freight.py`, updated FCL/LCL INSERT statements to include `terminal_id`
- **Files Modified:**
  - `af-server/migrations/014_port_terminals.sql` (new)
  - `af-server/scripts/run_migration_014.py` (new)
  - `af-server/routers/geography.py`
  - `af-server/routers/pricing/fcl.py`
  - `af-server/routers/pricing/lcl.py`
  - `af-server/scripts/migrate_pricing_freight.py`

---
