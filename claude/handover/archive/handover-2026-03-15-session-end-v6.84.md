# AF Dev Handover — Session 134 End
**Date:** 2026-03-15
**Session:** 134
**Version at close:** v6.84 (deployed to Cloud Run)
**Live on Cloud Run:** v6.84
**Tests:** v2.61 (272/286)

---

## Session Summary

Session focused entirely on the Exchange Rate (FX) module — built from scratch across four
prompt versions plus several direct MCP hotfixes.

### What was built

- **v6.82** — Initial exchange rate UI (two-panel layout, basic CRUD). Superseded by v6.83.
- **v6.83** — Full rebuild: `currency_rate_pairs` table (adjustment %, is_active), `fx_snapshot`
  on quotations, weekly time-series UI matching customs/local-charges pattern, `useWeekBuckets`
  hook, dynamic column count via ResizeObserver, no forward horizon.
- **v6.84** — RHB FX scraper: `POST /fetch-rhb` endpoint, "Fetch from RHB" button on currency
  page toolbar + Exchange Rates dashboard card.
- **Migration 062** — `currency_rate_pairs` + `fx_snapshot` on `quotations`. ✅ Applied to prod.

### Hotfixes applied directly via MCP (no Opus)

1. **Double-adjustment bug** — `pairs-with-series` was re-applying `adjustment_pct` on read,
   but stored values are already post-adjustment (baked in by scraper at write time).
   Fixed by setting `effective_rate = stored value` (no multiplication) in the series endpoint.

2. **MYR-origin inversion** — scraper now correctly inverts RHB's foreign/MYR rate for
   MYR-origin pairs: `final_rate = (1 / normalised) * (1 + adj_pct / 100)`.

### Rate storage convention (locked)
- `currency_rates.rate` stores **post-adjustment** value
- Scraper applies: `normalised * (1 + adj/100)` for target=MYR pairs
- Scraper applies: `(1/normalised) * (1 + adj/100)` for base=MYR pairs
- `pairs-with-series` returns stored value as-is — no re-application of adjustment
- `adjustment_pct` badge on UI is informational only

### RHB rate column selection
- `target_currency = MYR` → Bank Sell TT/OD
- `base_currency = MYR` → Bank Buy OD (then inverted)
- Neither base nor target = MYR → skipped

---

## Pending

- **Haulage price & cost calculation** — next major workstream (was reminder item from
  session start). Involves pricing engine for haulage legs using `area_id` + `vehicle_type`
  from GT order stops, both customer price and supplier cost sides.
- **Deploy v6.74–v6.84** — Calvin deploying to Cloud Run at session end ✅
- **`fx_snapshot` population** — column exists on `quotations` but not yet populated.
  Will be wired in during haulage/quotation calculation engine workstream.

---

## Architecture Reference (FX)

| Item | Detail |
|---|---|
| Raw rate table | `currency_rates` — weekly rows, `effective_from` = Monday |
| Pair metadata | `currency_rate_pairs` — `adjustment_pct`, `is_active`, `notes` |
| FX snapshot | `quotations.fx_snapshot` JSONB — populated at calculation time (not yet wired) |
| Series endpoint | `GET /api/v2/pricing/currency/pairs-with-series?weeks=N` |
| Scraper endpoint | `POST /api/v2/pricing/currency/fetch-rhb` (admin only) |
| Source | https://www.rhbgroup.com/treasury-rates/foreign-exchange/index.html |

## Key File Paths

| File | State |
|---|---|
| `af-server/routers/pricing/currency.py` | v6.84 + hotfixes — final correct state |
| `af-server/migrations/062_currency_pairs.sql` | Applied to prod ✓ |
| `af-server/scripts/run_migration_062.py` | Executed ✓ |
| `af-platform/src/app/(platform)/pricing/currency/page.tsx` | v6.83 rebuild + v6.84 fetch button |
| `af-platform/src/app/(platform)/pricing/_dashboard.tsx` | v6.84 — CurrencyCard with fetch button |
| `af-platform/src/app/(platform)/pricing/_helpers.ts` | v6.83 — useWeekBuckets added |
| `af-platform/src/app/actions/pricing.ts` | v6.84 — all currency actions present |

---

## Next Session Start

1. Check `list_directory` on handover + log folders to confirm filenames
2. Read this handover file
3. Session header: `AF Dev — Session 135 | AcceleFreight v2 | v6.84 Live | — Prompt Ready | Tests v2.61 (272/286)`
4. First workstream: **Haulage price & cost calculation**
   - Read `af-server/routers/pricing/haulage.py` and `af-server/migrations/037_haulage_pricing.sql`
   - Understand area + vehicle type schema before designing the pricing engine
   - Key inputs: `order_stops.area_id`, GT order `task_ref`, vehicle type from GT order

---

## Backlog

### 🔴 Next Up
- **Haulage price & cost calculation** — pricing engine for haulage legs

### 🟡 Queued
- `fx_snapshot` population on quotation calculation
- Geography → Tax Rules admin UI
- Manual line item tax application
- `is_domestic` audit on DG Class Charges
- Air freight data migration
- AF-API-Pricing.md update (currency endpoints not yet documented)
