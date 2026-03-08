# Prompt Completion Log — v5.21–v5.30

### [2026-03-08 22:00 UTC] — v5.30: Expanded Rate Panel: Scroll Isolation + Sort by Last Updated
- **Status:** Completed
- **Tasks:**
  - Fix 1: Wrapped `ExpandedRatePanel` in bounded scroll container — `maxHeight: 320px`, `overflowY: auto`; fits ~4–5 supplier rows before scrollbar appears; loading spinner state unchanged
  - Fix 2: Sorted supplier rows by last effective date descending (most recent first) — moved `getLatestEffective` before sort, alphabetical tie-break by company name; null dates sort to bottom
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---

### [2026-03-08 21:00 UTC] — v5.29: Rate Card Sparkline: 2 Remaining Fixes
- **Status:** Completed
- **Tasks:**
  - Fix 1: Replaced `sticky top-0` approach with internal scroll container — outer `flex flex-col` with `maxHeight: 70vh`, frozen header (`shrink-0 overflow-x-auto`), scrollable body (`overflow-auto flex-1` with inner `minWidth` wrapper)
  - Fix 2: Replaced viewBox scaling with exact pixel coordinates — `COL_W = 80`, `toX = i * 80 + 40`, SVG uses `width={totalW}` + matching `viewBox`, sparkline containers set to exact `width: months.length * 80` with `flexShrink: 0`
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---

### [2026-03-08 20:00 UTC] — v5.28: Rate Card Sparkline: 4 Fixes
- **Status:** Completed
- **Tasks:**
  - Fix 1: Moved sticky header outside `overflow-x-auto` container — now uses `overflow-x-hidden` wrapper with `sticky top-0 z-10`, data rows scroll independently below
  - Fix 2: Fixed sparkline dot alignment — changed `toX` formula from edge-to-edge to column-centre: `((i + 0.5) / months.length) * vw`
  - Fix 3: Replaced List Price per-cell numbers with blue sparkline (`color="#0ea5e9"`) — added `color` prop to `CostSparkline` component (default red, blue for list price)
  - Fix 4: Added current month value label above dot in sparklines — `<text>` element 6px above dot, `fontSize="8"`, `fontWeight="600"`; increased SVG height from 36→48 with `pad=14`
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---

### [2026-03-08 19:00 UTC] — v5.27: Rate Card View: 5 Refinements
- **Status:** Completed
- **Tasks:**
  - Fix 1: Sticky month header (`sticky top-0 z-10`) + unified horizontal scroll — single `overflow-x-auto` wrapper, removed per-row scrollbars, `minWidth` on all rows
  - Fix 2: `CostSparkline` component for supplier rows in expanded panel — red line chart with dots, current month marker, native SVG tooltips; List Price row keeps per-cell numbers
  - Fix 3: Added last effective date (`Last: DD Mon YYYY`) to left gutter of both List Price and supplier rows in expanded panel
  - Fix 4: Visual separation — active row gets `border-l-2 border-l-[var(--sky)]` + sky-mist bg; expanded panel uses `bg-slate-50/80` + `border-b-2`; "Supplier Costs" section divider between List Price and supplier rows
  - Fix 5: `getDGChipStyle` helper for colour-coded DG classification chips; FCL shows DG chip alongside container chip (suppressed for GEN/GENERAL/NDG); LCL always shows DG chip
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---

### [2026-03-08 18:00 UTC] — v5.26: Rate Card: Revert to Cell View + Expand Panel with Supplier Breakdown
- **Status:** Completed
- **Tasks:**
  - Removed `RateSparkline` SVG component entirely
  - Reverted header from `flex justify-between` to column-based `w-[80px]` cells with current month highlight
  - Reverted data rows to per-column cell grid showing list_price (top) and cost (bottom) per month
  - Added expand-on-click with `expandedId`/`expandedDetail`/`expandLoading` state management
  - Added `mode` prop ('fcl' | 'lcl') to `TimeSeriesRateList` for correct detail action dispatch
  - Added `companiesMap` prop for supplier name lookup, fetched via `fetchCompaniesAction` on mount
  - Created `ExpandedRatePanel` component: List Price row first, then per-supplier rows with cost values
  - Client-side carry-forward in expanded panel with future month guard (no carry into future months)
  - Added ChevronDown/ChevronUp toggle icons in identity panel
  - Re-imported `fetchFCLRateCardDetailAction`, `fetchLCLRateCardDetailAction`, `RateCardDetail`, `RateDetail`
  - Updated skeleton loading to match cell grid layout
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---

### [2026-03-08 17:00 UTC] — v5.25: Rate Card Time Series: Line Chart + No Future Carry-Forward
- **Status:** Completed
- **Tasks:**
  - Change 1: Backend — stopped carry-forward from bleeding into future months; future months only show data if an explicit rate exists for that exact month (FCL + LCL)
  - Change 1b: LCL — added seed queries for pre-window last known values (FCL already had these from user edit)
  - Change 2: Frontend — replaced per-column number cells with `RateSparkline` inline SVG line chart (green line for list_price, red dashed for cost, dots with native SVG tooltips, current month vertical marker)
  - Change 2b: Updated header row to `flex justify-between` evenly distributed month labels
  - Change 2c: Added current month values display below chart (green price, muted cost)
  - Change 2d: Updated skeleton loading state for chart layout
- **Files Modified:**
  - `af-server/routers/pricing/fcl.py`
  - `af-server/routers/pricing/lcl.py`
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---

### [2026-03-08 16:00 UTC] — v5.24: Rate Card Time Series: 3 Targeted Fixes
- **Status:** Completed
- **Tasks:**
  - Fix 1: Changed month label format from locale string to `yy-mm` (e.g. `26-03`)
  - Fix 2: Reduced window from 12 months to 9 months (6 past + current + 2 forward) in both frontend and backend (FCL + LCL)
  - Fix 3: Added carry-forward logic — rates with no exact month match now inherit the most recent preceding value instead of showing `—`
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/_components.tsx`
  - `af-server/routers/pricing/fcl.py`
  - `af-server/routers/pricing/lcl.py`

---

### [2026-03-08 15:30 UTC] — v5.23: Rate Card Time Series View (FCL + LCL)
- **Status:** Completed
- **Tasks:**
  - Backend: Extended `list_fcl_rate_cards` and `list_lcl_rate_cards` with `time_series` field — 12-month array (6 past + current + 5 future), single bulk query per table, no N+1
  - Backend: Price-ref rows (supplier_id IS NULL, PUBLISHED/DRAFT) matched by month bucket with latest effective_from tiebreaker; cost rows (supplier_id IS NOT NULL, PUBLISHED) aggregated by min cost
  - Frontend: Created `TimeSeriesRateList` shared component — left identity panel (220px, dest code/name, container/DG chip, active dot, draft badge) + right scrollable 12-month grid (80px cells, list_price top, cost bottom)
  - Frontend: Current month column highlighted with sky-mist tint, DRAFT prices shown in amber
  - Frontend: Removed `RateCardRow`, `RateHistoryPanel`, expand state, `fetchFCLRateCardDetailAction`/`fetchLCLRateCardDetailAction` imports
  - Frontend: Added `time_series` and `pending_draft_count` to `RateCard` interface in `pricing.ts`
  - Frontend: Skeleton loading state (5 rows with pulsing cells) replaces spinner
- **Files Modified:**
  - `af-server/routers/pricing/fcl.py`
  - `af-server/routers/pricing/lcl.py`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---

### [2026-03-08 14:45 UTC] — v5.22: rate_status Enum Extension + Rate Deduplication
- **Status:** Completed
- **Tasks:**
  - Task 1: Created `migrations/016_rate_status_draft_rejected.sql` — adds DRAFT and REJECTED to rate_status enum (IF NOT EXISTS, no transaction block)
  - Task 2: Created `scripts/dedup_rates.py` — identifies and deletes redundant historical rate rows using LAG() window functions, --dry-run default, --execute with confirmation, IS NOT DISTINCT FROM for NULL equality, rn>1 guard to protect most recent rows
  - Task 3: Updated `fcl.py` — extended `_VALID_RATE_STATUSES` with DRAFT/REJECTED, added `publish_fcl_rate` and `reject_fcl_rate` endpoints (DRAFT->PUBLISHED/REJECTED, admin only), added `pending_draft_count` to `list_fcl_rate_cards`
  - Task 4: Updated `lcl.py` — identical changes as Task 3 for LCL router
- **Files Modified:**
  - `af-server/migrations/016_rate_status_draft_rejected.sql` (new)
  - `af-server/scripts/dedup_rates.py` (new)
  - `af-server/routers/pricing/fcl.py`
  - `af-server/routers/pricing/lcl.py`
- **Notes:** Migration and dedup script are NOT to be executed by Opus — Calvin runs manually

---

### [2026-03-08 09:30 UTC] — v5.21: Fix PortCombobox Selection & Terminal Auto-Assign
- **Status:** Completed
- **Tasks:**
  - Rewrote `PortCombobox.tsx` — removed `mouseDownRef` blur guard entirely, simplified `onBlur` to unconditionally close dropdown
  - List items use `onMouseDown` with `e.preventDefault()` to prevent input blur during click (proven pattern)
  - Removed container div `onMouseDown`/`onMouseUp` handlers that set/cleared the ref
  - Terminal auto-assign `useEffect` reordered guards: checks `terminalValue` emptiness inside effect body, reads from props directly, deps remain `[value, options]` with eslint-disable
  - Moved `onTerminalChange` presence check inside `showTerminal` condition for cleaner rendering guard
  - All existing behaviour preserved: keyboard nav, scroll-to-highlighted, clear-on-empty, className/placeholder/sublabel
- **Files Modified:**
  - `af-platform/src/components/shared/PortCombobox.tsx`

---
