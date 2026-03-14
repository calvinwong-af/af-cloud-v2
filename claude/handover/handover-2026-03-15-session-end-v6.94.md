# AF Dev Handover — Session 136 End
**Date:** 2026-03-15
**Session:** 136
**Version at close:** v6.94 (prompt complete, pending deploy)
**Live on Cloud Run:** v6.84
**Tests:** v2.61 (272/286)

---

## Session Summary

Session focused on three workstreams: UI consistency audit (UI-18), data integrity
migration series (currency/UOM to card level), and haulage pricing engine design.

### Prompts completed this session

- **v6.89** — RHB cross-rate support: non-MYR currency pairs now calculated via MYR
  bridge using sell_tt_od/unit normalisation with division and adjustment_pct applied.

- **v6.90** — UI-18 cross-module consistency: FCL/LCL (`_expanded-panel.tsx`) and Air
  (`_air-expanded-panel.tsx`) updated to match haulage pattern — Pencil+Trash2 icon
  buttons, inline "Sure? Yes/No" delete confirm, terminate flow removed. `PanelMode`
  terminate variant removed from `_types.ts`.

- **v6.91** — FCL currency+uom → card level (migration 065). `_row_to_rate` re-indexed,
  time series reads from card, rate modal updated.

- **v6.92** — LCL currency+uom → card level (migration 066). Same pattern as FCL.
  `resolve_lcl_rate` fetches currency from card via separate lookup.

- **v6.93** — Air currency → card level (migration 067). Both `air_freight_rate_cards`
  and `air_list_price_rate_cards` updated. `_RATE_SELECT` and `_LIST_PRICE_RATE_SELECT`
  re-indexed.

- **v6.94** — `is_tariff_rate` engine implementation + PKG data migration (migration 068).
  `_resolve_haulage` now branches on `is_tariff_rate`: tariff model applies rebate against
  supplier gross cost; non-tariff uses supplier cost as-is with no rebate lookup.

### Migrations applied to prod

| Migration | Description | Status |
|---|---|---|
| 063 | Haulage currency+uom → card | ✅ Applied (prior session) |
| 064 | Haulage is_tariff_rate column | ✅ Applied (prior session) |
| 065 | FCL currency+uom → card (37 cards) | ✅ Applied |
| 066 | LCL currency+uom → card (56 cards, W/M default) | ✅ Applied |
| 067 | Air currency → card (both card tables) | ✅ Applied |
| 068 | MYPKG cards → is_tariff_rate=TRUE | ✅ Applied |

---

## Pending Deploy

All of v6.85–v6.94 are prompt-complete, all migrations applied. **10 versions pending.**
Deploy held until haulage pricing surcharge design is finalised.
Deploy order: v6.85 → v6.86 → ... → v6.94 sequentially.

---

## Architecture Notes (post-session state)

### Currency/UOM integrity — complete
All pricing modules now have currency (and UOM where applicable) at card level:
- `fcl_rate_cards`: currency, uom
- `lcl_rate_cards`: currency, uom
- `haulage_rate_cards`: currency, uom (since v6.86/migration 063)
- `air_freight_rate_cards`: currency
- `air_list_price_rate_cards`: currency
Rate rows no longer carry currency or uom in any module.

### Haulage is_tariff_rate model (post-v6.94)
- `is_tariff_rate = TRUE` (MYPKG and future tariff ports):
  - price = list price row
  - cost = supplier cost row × (1 - rebate_percent)
  - Rebate from `haulage_supplier_rebates` (supplier + port + container_size)
- `is_tariff_rate = FALSE` (non-tariff ports):
  - price = list price row
  - cost = supplier cost row as-is, no rebate lookup
- 939 total haulage rate cards; MYPKG cards flagged TRUE (exact count in migration 068 runner output)

### UI-18 status: CLOSED
FCL/LCL shared panel and Air panel now match haulage pattern. `PanelMode` terminate
variant fully removed from `_types.ts`. `onDelete` prop preserved on `RateModal` as
parallel delete path alongside inline delete confirm.

---

## Next Session Start

1. `list_directory` on handover + log folders
2. Read this file + `AF-Test-Master.md` + prompt log head:25 (`PROMPT-LOG-v6.91-v7.00.md`)
3. Session header: `AF Dev — Session 137 | AcceleFreight v2 | v6.84 Live | v6.94 Prompt Ready | Tests v2.61 (272/286)`
4. First task: haulage surcharge design discussion, then prompt

---

## Backlog Highlights

### 🔴 Next Up
- Haulage surcharge design + engine implementation (Calvin to brief)
- `is_tariff_rate` surcharge handling (deferred — "we'll go into surcharges more later")
- Deploy v6.85–v6.94 batch (held pending haulage surcharge finalisation)

### 🟡 Queued
- `fx_snapshot` population on quotation calculation
- Geography → Tax Rules admin UI
- `is_domestic` audit on DG Class Charges
- Air freight data migration
- AF-API-Pricing.md update (haulage card schema + currency endpoints)
- UI-17: Per-user default country (low priority)
- PR-01: Surcharge model clarification (may be closeable — review)

### 🟢 Closed this session
- UI-18: Cross-module UI consistency audit ✅

---

## Key Design Decisions Made This Session

**Currency/UOM at card level:** Rationale — per-row currency exposes system to silent
data integrity violations (different rows on same card could have different currencies).
Card-level enforces consistency. Backfill from latest rate row; defaults MYR/CONTAINER
(FCL), MYR/W/M (LCL), MYR (Air).

**is_tariff_rate model clarified:**
- Tariff = rebate applied against supplier gross cost (not the tariff/list price itself)
- Non-tariff = no rebate, supplier cost taken as-is
- Supplier cost rows still entered in both models for data structure consistency
- Rebate is exclusively a tariff-model concept

**RHB cross-rate:** Both legs normalised via sell_tt_od/unit, cross = base/target.
Notes field tagged "cross via MYR" for DB auditability.

---

## Key File Paths (changed this session)

| File | State |
|---|---|
| `af-server/routers/quotations.py` | v6.94 — is_tariff_rate branch in _resolve_haulage |
| `af-server/routers/pricing/fcl.py` | v6.91 — currency+uom on card |
| `af-server/routers/pricing/lcl.py` | v6.92 — currency+uom on card |
| `af-server/routers/pricing/air.py` | v6.93 — currency on card |
| `af-server/routers/pricing/currency.py` | v6.89 — cross-rate support |
| `af-server/migrations/065–068` | All applied ✅ |
| `af-platform/src/app/(platform)/pricing/_types.ts` | v6.90 — PanelMode terminate removed |
| `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx` | v6.90 — icon buttons + inline delete |
| `af-platform/src/app/(platform)/pricing/air/_air-expanded-panel.tsx` | v6.90 — same |
| `af-platform/src/app/(platform)/pricing/_rate-modal.tsx` | v6.92 — currency removed |
| `af-platform/src/app/(platform)/pricing/air/_air-rate-modal.tsx` | v6.93 — currency removed |
| `af-platform/src/app/actions/pricing.ts` | v6.93 — all interfaces updated |
