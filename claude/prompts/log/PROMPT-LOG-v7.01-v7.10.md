## Prompt Log — v7.01 to v7.10

### [2026-03-15 19:00 UTC] — v7.06: Quotation Table Per-Row Currency + Trade Direction Change Feature
- **Status:** Completed
- **Tasks:**
  - Removed currency badge from PRICE/UNIT and COST/UNIT column headers (kept on EFF. PRICE and EFF. COST)
  - Added per-row inline currency on PRICE/UNIT and COST/UNIT cells when `price_currency`/`cost_currency` differs from quotation currency
  - Added `quotationCurrency` prop to `GroupRows` component; applied same logic to inline "Other Charges" rows
  - Added `PATCH /api/v2/orders/{id}/transaction-type` endpoint — validates draft status, updates transaction_type, resets workflow tasks via `generate_tasks`, flags open quotations
  - Added `updateTransactionTypeAction` server action in `shipments-write.ts`
  - Added `TradeDirectionModal` component with toggle buttons, amber warning, and confirm/cancel flow
  - Added pencil icon next to transaction type in shipment detail header (AFU + Draft only)
- **Files Modified:**
  - `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`
  - `af-server/routers/orders.py`
  - `af-platform/src/app/actions/shipments-write.ts`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
- **Notes:**
  - Post-deploy fix: removed `updated_at` from `shipment_details` UPDATE (column doesn't exist on that table)
  - Post-deploy fix: removed `c.preferred_currency` query in `quotations.py` `create_quotation` — `companies` table has no `preferred_currency` column; defaulted to `'MYR'`

### [2026-03-15 18:30 UTC] — v7.05: EXPORT/IMPORT Order Swap + Default to EXPORT
- **Status:** Completed
- **Tasks:**
  - Changed default `transactionType` state from `'IMPORT'` to `'EXPORT'` in `CreateShipmentModal.tsx`
  - Swapped button render order from `['IMPORT', 'EXPORT']` to `['EXPORT', 'IMPORT']` in `StepOrder.tsx`
- **Files Modified:**
  - `af-platform/src/components/shipments/CreateShipmentModal.tsx`
  - `af-platform/src/components/shipments/_create-shipment/StepOrder.tsx`

### [2026-03-15 18:00 UTC] — v7.04: Quotation Table Currency Header + New Order Opens in New Tab
- **Status:** Completed
- **Tasks:**
  - Hoisted currency labels from individual PRICE/UNIT and COST/UNIT data cells to column headers (Price/unit, Cost/unit, Eff. Price, Eff. Cost) using `totals?.currency`
  - Removed inline `<span>{li.price_currency}</span>` / `{li.cost_currency}` from both inline add rows and GroupRows data cells
  - Changed `window.location.href` to `window.open(..., '_blank')` in NewShipmentButton so new shipment orders open in a new tab
- **Files Modified:**
  - `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`
  - `af-platform/src/components/shipments/NewShipmentButton.tsx`
- **Notes:** Currency badge uses `text-[9px] font-normal normal-case text-[var(--text-muted)]/60` for subtle appearance. Both creation paths (manual + BL upload) use the same `onCreated` callback, so both open in new tab.

### [2026-03-15 17:00 UTC] — v7.03: DGF List Strict Terminal Filtering
- **Status:** Completed
- **Tasks:**
  - Added `strict` query param to `list_depot_gate_fees` endpoint — when true, uses exact terminal_id match (or `terminal_id IS NULL` for port-level) instead of fallback logic
  - Added `strict` optional param to `fetchDepotGateFeesAction` in pricing.ts
  - Updated `DgfManageDialog.loadFees` to pass `strict: true`
- **Files Modified:**
  - `af-server/routers/pricing/haulage.py`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/app/(platform)/pricing/haulage/_depot-gate-fee-modal.tsx`
- **Notes:** Default `strict=false` preserves existing fallback behaviour for all other callers (time series, active fee endpoint).

### [2026-03-15 16:00 UTC] — v7.02: DGF in Haulage Time Series (cost_surcharge_total + cost_surcharge_items)
- **Status:** Completed
- **Tasks:**
  - Added `_get_dgf_amount` helper function to `haulage.py` (finds time-effective DGF fee for a given month)
  - Pre-fetched all published DGF rows from `port_depot_gate_fees` for cards with `include_depot_gate_fee = TRUE`, keyed by card_id with terminal-specific → port-level fallback
  - Added DGF amount to `cost_sc` and `cost_sc_items` in both historical and future branches of the time series loop
  - DGF appears as `{"label": "Depot Gate Fee", "amount": 60}` in tooltip breakdown
- **Files Modified:**
  - `af-server/routers/pricing/haulage.py`
- **Notes:** Backend only. Cards without `include_depot_gate_fee` are unaffected. `total_cost` now includes base + surcharges + FAF + DGF.
