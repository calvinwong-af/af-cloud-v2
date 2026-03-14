# AF Dev Handover — Session 138 End
**Date:** 2026-03-15
**Session:** 138
**Version at close:** v7.06 + 3 MCP hotfixes
**Live on Cloud Run:** v6.84
**Tests:** v2.61 (272/286)

---

## Session Summary

Long session covering the full DGF (Depot Gate Fee) workstream, quotation table improvements, new shipment order UX fixes, trade direction change feature, and several direct MCP fixes.

### Prompts completed this session

- **v7.00** — "Manage DGF" shortcut icon in `HaulageRateCardEditModal`. Settings2 icon + link appears when `include_depot_gate_fee` is ticked. Opens `DepotGateFeeModal` at z-[60].

- **v7.01** — `DgfManageDialog` — full list-based DGF management dialog with add/edit/delete and table of all rows. Removed DGF panel from expanded panel body (it now lives exclusively in the rate card edit modal).

- **v7.02** — DGF included in haulage time series `cost_surcharge_total` and `cost_surcharge_items`. Added `_get_dgf_amount` helper, pre-fetch block, applied in both historical and future branches.

- **v7.03** — DGF list strict terminal filtering. Added `strict` query param to `GET /depot-gate-fees` — when true, returns exact terminal match only (no port-level fallback). Used by `DgfManageDialog` to prevent cross-terminal row leakage.

- **v7.04** — Quotation table currency hoisted to column headers (block sub-line). New shipment order opens in new tab (`window.open`).

- **v7.05** — New Shipment Order modal: default transaction type changed to EXPORT, button order swapped to EXPORT | IMPORT.

- **v7.06** — Quotation table per-row currency: removed currency badge from PRICE/UNIT and COST/UNIT headers (non-uniform), kept on EFF. PRICE and EFF. COST. Added per-row inline currency indicator on PRICE/UNIT and COST/UNIT cells only when line item currency ≠ quotation currency. Also: trade direction change feature (IMPORT ↔ EXPORT on Draft shipments) — new `PATCH /orders/{id}/transaction-type` endpoint, `TradeDirectionModal` component, workflow reset, quotation stale flagging.

### MCP hotfixes applied this session (not in prompt log)

- **v7.04 hotfix** — `_components.tsx` thead: changed `ml-1` → `block` on all four currency span elements. Currency now sits on a sub-line beneath the header label instead of extending column width inline.

- **v7.06 hotfix A** — `quotations.py` `create_quotation`: restored company currency lookup using correct column name `c.currency` (Opus had hard-coded `currency = "MYR"` after incorrectly fixing a `preferred_currency` column-not-found error). New quotations for USD companies will now correctly use USD.

- **v7.06 hotfix B** — `shipments/[id]/page.tsx`: `onCreated` now calls `window.open('/quotations/${ref}', '_blank')` — quotation detail opens in new tab immediately after creation.

- **v7.06 hotfix C** — `quotations/_components.tsx`: added `target="_blank"` to quotation ref `<Link>` in quotations list — clicking any quotation ref opens in new tab.

---

## Pending Deploy Queue

**v6.85 → v7.06 = 22 versions pending** (plus 3 MCP hotfixes not versioned).
Calvin to deploy before next session.

### Migrations applied to prod this session
None — all session changes were frontend/backend logic only.

---

## Architecture Notes

### Quotation currency resolution (corrected)
- `quotations.currency` is set at creation time from `companies.currency` (the column is `currency`, not `preferred_currency`)
- All `effective_price` / `effective_cost` values in line items are in the quotation currency
- `price_per_unit` / `cost_per_unit` are in the source rate currency (can vary per line item)
- `price_conversion` / `cost_conversion` factors convert source → quotation currency

### DGF — canonical management path (post-v7.03)
- DGF fees managed via rate card edit modal → "Manage DGF" → `DgfManageDialog`
- `DgfManageDialog` uses `strict=true` to show only rows matching the exact terminal scope
- DGF NOT in the expanded panel body anymore
- `GET /depot-gate-fees` without `strict` retains fallback behaviour for time series

### Trade direction change (v7.06)
- Only available for Draft shipments (status 1001 / 1002)
- Resets `shipment_workflows` and flags open quotations as `scope_changed = TRUE`
- `TradeDirectionModal` in `shipments/[id]/page.tsx` (bottom of file)
- Backend: `PATCH /api/v2/orders/{id}/transaction-type` in `orders.py`

---

## Next Session Start

1. `list_directory` handover folder + log folder
2. Read this file + `AF-Test-Master.md` + `PROMPT-LOG-v7.01-v7.10.md` (head:30)
3. Session header: `AF Dev — Session 139 | AcceleFreight v2 | v6.84 Live | v7.06 Prompt Ready | Tests v2.61 (272/286)`
4. Deploy v6.85–v7.06 batch first if not done
5. Then address pending issues from testing

---

## Backlog Highlights

### 🔴 Next Up (from testing this session)
- **Deploy v6.85–v7.06** — 22 versions + 3 MCP hotfixes pending
- **Verify USD quotation currency** — test creating a quotation for Gandamar Shwe Pyi (AFC-0540, USD) post-hotfix — should now create with USD not MYR
- **Quotation: `fx_snapshot` population** — currently not populated on quotation calculation (flagged from earlier session, still pending)

### 🟡 Queued
- Geography → Tax Rules admin UI
- `is_domestic` audit on DG Class Charges
- Air freight data migration
- AF-API-Pricing.md update (haulage surcharge + DGF design)
- `alerts_only` SQL filter for haulage — doesn't account for FAF/DGF (acknowledged limitation)
- UI-19: Trade direction change (partially implemented — backend + modal done, further testing needed)

### 🟢 Closed this session
- DGF workstream (v7.00–v7.03) ✅
- Quotation currency display (v7.04 + hotfix) ✅
- New order / new quotation open in new tab ✅
- EXPORT default + button order swap ✅

---

## Key File Paths (changed this session)

| File | Change |
|---|---|
| `af-server/routers/pricing/haulage.py` | v7.02+v7.03 — DGF time series, strict filter |
| `af-platform/src/app/actions/pricing.ts` | v7.03 — strict param on fetchDepotGateFeesAction |
| `af-platform/src/app/(platform)/pricing/haulage/_haulage-expanded-panel.tsx` | v7.00+v7.01 — DGF panel removed, Manage DGF modal |
| `af-platform/src/app/(platform)/pricing/haulage/_depot-gate-fee-modal.tsx` | v7.01+v7.03 — DgfManageDialog, strict loadFees |
| `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx` | v7.04+v7.06+hotfix — currency headers/rows |
| `af-platform/src/app/(platform)/quotations/_components.tsx` | hotfix — target="_blank" on quotation list links |
| `af-platform/src/components/shipments/NewShipmentButton.tsx` | v7.04 — window.open new tab |
| `af-platform/src/components/shipments/CreateShipmentModal.tsx` | v7.05 — default EXPORT |
| `af-platform/src/components/shipments/_create-shipment/StepOrder.tsx` | v7.05 — EXPORT\|IMPORT order |
| `af-server/routers/orders.py` | v7.06 — PATCH transaction-type endpoint |
| `af-platform/src/app/actions/shipments-write.ts` | v7.06 — updateTransactionTypeAction |
| `af-platform/src/app/(platform)/shipments/[id]/page.tsx` | v7.06+hotfix — TradeDirectionModal, new tab quotation |
| `af-server/routers/quotations.py` | hotfix — c.currency restored in create_quotation |
