# AF Dev Handover — Session 137 End
**Date:** 2026-03-15
**Session:** 137
**Version at close:** v6.99 + 1 MCP hotfix (list price cell formatCompact)
**Live on Cloud Run:** v6.84
**Tests:** v2.61 (272/286)

---

## Session Summary

Session focused entirely on haulage pricing display accuracy — surcharge consistency,
FAF inclusion, and cost/price parity between the card row, sparkline, and quotation engine.

### Prompts completed this session

- **v6.95** — Haulage expanded panel: condensed supplier row (3-line layout), FAF amount
  displayed in panel (`FAF +517 (22.0%)`), FAF injected as virtual SurchargeItem into
  supplier sparkline surchargesMap for tooltip and current-month label.

- **v6.96** — Haulage rate list: added `SurchargeTooltip` (copied from FCL) to show `*`
  indicator on card row cost cells with hover breakdown. Frontend-only.

- **v6.97** — Haulage rate list: list price cell uses `cost_surcharge_total` (not
  `list_surcharge_total`) since surcharges in haulage live on supplier cost rows.

- **v6.98** — Backend: FAF-inclusive cost aggregation in `list_haulage_rate_cards`
  time_series builder. Added `_get_faf_percent` helper, pre-fetched FAF rows by supplier,
  added `supplier_id` to cost tracking, extended `cost_map` tuples to 3-tuple. Both
  historical and future branches now compute `cost_sc = raw_surcharges + FAF_amount`.

- **v6.99** — Itemised surcharge tooltip (`HaulageSurchargeTooltip`) replacing generic
  `SurchargeTooltip` in haulage rate list. Added `cost_surcharge_items` to backend
  time_series (named items including FAF). List price sparkline now receives best
  supplier's cost surcharges (including FAF) — shows `*` indicator and correct totals.

- **v6.99b (MCP hotfix)** — `_haulage-rate-list.tsx`: list price cell `formatCompact`
  was still using `list_surcharge_total ?? surcharge_total ?? 0` instead of
  `cost_surcharge_total ?? 0`. Fixed directly via MCP `edit_file`. Opus had updated
  the tooltip condition but missed the display value. Now shows `3,034` correctly.

### Result state (Air Hitam, Johor / MYPKG card)
- Card row: list price `3,034*` / cost `3,034*` — both consistent ✓
- Card row tooltip: Cost `2,350` / Toll Fee `+167` / FAF (22.0%) `+517` / Total `3,034` ✓
- List price sparkline: current-month label `3,034`, tooltip shows breakdown ✓
- Supplier sparkline: current-month label `3,034`, tooltip shows breakdown ✓
- Quotation engine: already correct (was correct before this session) ✓

---

## Pending Deploy Queue

All of v6.85–v6.99 are prompt-complete. **15 versions pending** + 1 MCP hotfix.
Calvin to deploy before end of day. Deploy order sequential: v6.85 → ... → v6.99.

### Migrations applied to prod this session
None — all changes this session were frontend/backend logic only, no schema changes.

---

## Architecture Notes (post-session state)

### Haulage surcharge calculation — canonical path
Cost displayed in pricing table = `supplier_base_cost + rate_row_surcharges + FAF_amount`
- `rate_row_surcharges`: from `haulage_rates.surcharges` JSONB (e.g. Toll Fee)
- `FAF_amount`: `base_cost × faf_percent` from `haulage_faf_rates` (per port/container)
- All computed server-side in `list_haulage_rate_cards` → `cost_surcharge_total`
- `cost_surcharge_items` carries named breakdown for tooltip rendering

### List price in pricing table = list_price + cost_surcharge_total
This matches quotation engine behaviour: customer pays list_price + all cost-side
surcharges (Toll Fee, FAF). `list_surcharge_total` is always 0 for haulage.

### Depot Gate Fee (DGF) — NOT yet in time series
DGF is included in the quotation engine (`_resolve_haulage` → `HA-DPG` line item) when
`include_depot_gate_fee = TRUE` on the rate card. However, DGF is **not yet included**
in the pricing table `cost_surcharge_total` or `cost_surcharge_items`. This is the
**next logical fix** — same pattern as FAF: fetch from `port_depot_gate_fees` by
`port_un_code` + `terminal_id` in the time series builder and add to `cost_sc`.
Cards with `+DGF` badge will show underreported totals until this is done.

---

## Next Session Start

1. `list_directory` on handover + log folders
2. Read this file + `AF-Test-Master.md` + prompt log head:25 (`PROMPT-LOG-v6.91-v7.00.md`)
3. Session header: `AF Dev — Session 138 | AcceleFreight v2 | v6.84 Live | v6.99 Prompt Ready | Tests v2.61 (272/286)`
4. First task: **DGF in haulage time series** — add depot gate fee to `cost_surcharge_total`
   and `cost_surcharge_items` in `list_haulage_rate_cards` (backend only, same pattern as FAF)

---

## Backlog Highlights

### 🔴 Next Up
- **DGF in haulage time series** — `cost_sc += dgf_fee_amount` when `include_depot_gate_fee`
  is TRUE; add `{label: "Depot Gate Fee", amount: N}` to `cost_surcharge_items`
- Deploy v6.85–v6.99 batch (Calvin to handle end of day)

### 🟡 Queued
- `fx_snapshot` population on quotation calculation
- Geography → Tax Rules admin UI
- `is_domestic` audit on DG Class Charges
- Air freight data migration
- AF-API-Pricing.md update (haulage surcharge design + currency endpoints)
- `alerts_only` SQL filter for haulage — currently does not account for FAF/DGF
  (noted in v6.98 as acknowledged limitation)

### 🟢 Closed this session
- Haulage surcharge display series (v6.95–v6.99b) ✅

---

## Key File Paths (changed this session)

| File | State |
|---|---|
| `af-server/routers/pricing/haulage.py` | v6.98+v6.99 — FAF in time_series, cost_surcharge_items |
| `af-server/routers/quotations.py` | Unchanged this session — DGF already implemented |
| `af-platform/src/app/(platform)/pricing/haulage/_haulage-rate-list.tsx` | v6.96+v6.99+hotfix |
| `af-platform/src/app/(platform)/pricing/haulage/_haulage-expanded-panel.tsx` | v6.95+v6.99 |
| `af-platform/src/app/actions/pricing.ts` | v6.99 — cost_surcharge_items on HaulageTimeSeries |
