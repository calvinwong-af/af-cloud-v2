# Prompt Completion Log — v5.51–v5.60

### [2026-03-09 14:30 UTC] — v5.51: LCL Min Quantity on Supplier Rows + FCL Min Fields Removal
- **Status:** Completed
- **Tasks:** (1) Created migration `020_lcl_min_quantity.sql` — renames `min_cost` → `min_quantity` on `lcl_rates`. (2) Updated `fcl.py` — removed `min_list_price` and `min_cost` from Pydantic models, `_RATE_SELECT`, `_row_to_rate`, INSERT, UPDATE `field_map`, and all time series builder queries/dicts. (3) Updated `lcl.py` — removed `min_list_price`, renamed `min_cost` → `min_quantity` throughout Pydantic models, `_RATE_SELECT`, `_row_to_rate`, INSERT, UPDATE `field_map`, seed queries, and time series builder. (4) Updated `pricing.ts` — replaced `min_list_price`/`min_cost` with `min_quantity` in `RateDetail`, `RateCard.time_series`, `RateCreateData`, `RateUpdateData`. (5) Updated `_rate-modal.tsx` — replaced `minListPrice`/`minCost` state with `minQuantity`; FCL and LCL list price modes show no min field; LCL supplier mode shows "Min qty (W/M)". (6) Updated `_expanded-panel.tsx` — displays "Min: X W/M" on LCL supplier rows when `min_quantity` is set. (7) Ran migration 020 on local DB.
- **Files Modified:** `af-server/migrations/020_lcl_min_quantity.sql` (new), `af-server/routers/pricing/fcl.py`, `af-server/routers/pricing/lcl.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/_rate-modal.tsx`, `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx`

### [2026-03-09 15:00 UTC] — v5.52: Terminal Name on Rate Card Display
- **Status:** Completed
- **Tasks:** (1) fcl.py — LEFT JOIN `port_terminals` in `list_fcl_rate_cards` and `get_fcl_rate_card`; patch `terminal_name` onto card dict from extra column. (2) lcl.py — same LEFT JOIN pattern in `list_lcl_rate_cards` and `get_lcl_rate_card`. (3) pricing.ts — added `terminal_name: string | null` to `RateCard` interface. (4) `_rate-list.tsx` — rendered indigo terminal badge when `card.terminal_name` is set, placed after DG chip and before draft badge.
- **Files Modified:** `af-server/routers/pricing/fcl.py`, `af-server/routers/pricing/lcl.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/_rate-list.tsx`

### [2026-03-09 15:30 UTC] — v5.53: Rate Card Alert Badges — Scenarios 1 & 2 (Frontend Only)
- **Status:** Completed
- **Tasks:** (1) `_helpers.ts` — replaced `hasMarginAlert` with `getAlertLevel` returning `AlertLevel` type (`'cost_exceeds_price' | 'no_list_price' | null`); evaluates current month bucket only with proper cost/list surcharge totals. (2) `_rate-list.tsx` — imported `getAlertLevel`; computed `alertLevel` per card; rendered red "Cost exceeds price" badge (scenario 1) and amber "No list price" badge (scenario 2); replaced inner `isMarginAlert` with `cellAlert` for current-month cell tinting; updated list price text colour per alert level.
- **Post-execution UI revision (MCP direct):** Row highlight upgraded from cell-only tinting to full row background + left accent border (`border-l-2`). Badges upgraded to `bg-*-200 font-semibold` for stronger contrast against tinted row. Scenario 3 badge stub (`price_review_needed`) added ahead of v5.54. Cell tinting removed (row colour supersedes it). Applied directly to `_rate-list.tsx` via Claude MCP.
- **Files Modified:** `af-platform/src/app/(platform)/pricing/_helpers.ts`, `af-platform/src/app/(platform)/pricing/_rate-list.tsx`

### [2026-03-09 16:00 UTC] — v5.54: Dashboard Alert Counts + Scenario 3 (Price Review Needed)
- **Status:** Completed
- **Post-execution fix (MCP direct):** Row highlight was masked by `isExpanded` taking priority in the ternary chain. Fixed by decoupling background (alert wins always) from left border (expanded state wins for border colour only). `border-l-transparent` added for clean non-alert rows. Applied directly to `_rate-list.tsx` via Claude MCP.

### [2026-03-09 17:00 UTC] — v5.55: Alert Filter Toggle + Dashboard Navigation Links
- **Status:** Completed

### [2026-03-09] — MCP Direct: + Set List Price button on expanded panel
- `_expanded-panel.tsx` — added `+ Set List Price` button (dashed sky style, matching `+ Supplier Rate`) when `priceRefRates.length === 0`. Wired to existing `add-list-price` modal mode.

### [2026-03-09] — MCP Direct: Hide surcharges from list price modal
- `_rate-modal.tsx` — wrapped surcharges section with `{!isListPriceMode && ...}`. List price modal (add-list-price, edit/update with supplier_id === null) no longer shows surcharges. Supplier rate modals unaffected.
- **Tasks:** (1) `fcl.py` + `lcl.py` — added `alerts_only: bool = Query(default=False)` param to list endpoints; when true, appends 3-scenario alert WHERE clause (cost > price, no list price, cost date > list price date) and skips origin filter. (2) `pricing.ts` — added `alertsOnly?: boolean` to FCL/LCL fetch action params; passes as `alerts_only` query param. (3) `_rate-cards-tab.tsx` — added `alertFilter` prop + `showIssuesOnly` state to both FCL/LCL tabs; "Issues only" toggle button in filter bar; bypasses origin guard when active; passes `alertsOnly` to fetch; count line shows "X cards with issues". (4) `fcl/page.tsx` + `lcl/page.tsx` — read `?alerts=` search param, pass as `alertFilter` prop. (5) `_dashboard.tsx` — converted alert tray `div` lines to `Link` components with `?country=...&alerts=<scenario>` href + `e.stopPropagation()`.
- **Files Modified:** `af-server/routers/pricing/fcl.py`, `af-server/routers/pricing/lcl.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/_rate-cards-tab.tsx`, `af-platform/src/app/(platform)/pricing/fcl/page.tsx`, `af-platform/src/app/(platform)/pricing/lcl/page.tsx`, `af-platform/src/app/(platform)/pricing/_dashboard.tsx`
