# AF Dev Handover — Session 135 End
**Date:** 2026-03-15
**Session:** 135
**Version at close:** v6.86 (prompt complete, pending deploy)
**Live on Cloud Run:** v6.84
**Tests:** v2.61 (272/286)

---

## Session Summary

Session focused on the haulage pricing module — three prompts covering surcharge handling,
rate card/rate node separation, and a migration-backed schema refactor.

### What was built

- **v6.85** — Haulage surcharge + edit card fixes:
  - `HaulageRateCardEditModal` added (inline in expanded panel)
  - Sparkline tooltip: surcharge `description` shown instead of `code`
  - `_resolve_haulage` surcharge loop rewritten to union list price + supplier surcharges;
    supplier-only surcharges now pass through at cost on both price and cost sides

- **v6.86** — currency + uom moved from rate rows to rate card level:
  - Migration 063: `currency` + `uom` added to `haulage_rate_cards`, backfilled from latest
    rate row, NOT NULL set, then dropped from `haulage_rates`
  - `haulage.py`: card models gain currency/uom; rate models lose them; all queries updated;
    time-series builder uses `card_currency_map` instead of reading from rate rows
  - `quotations.py → _resolve_haulage`: currency now read from card row (`card[3]`),
    all `lp`/`sc` column indices updated accordingly
  - Rate node modal: currency + uom fields removed
  - Edit Rate Card modal: expanded to show read-only identity (port/area/container/terminal)
    + editable currency/uom/flags
  - Pencil icon on hover in card rows (customs pattern), wired from `_haulage-rate-cards-tab.tsx`

### Migrations applied to prod
- Migration 063 (`063_haulage_card_currency_uom.sql`) ✅ applied

---

## Pending Deploy

v6.85 and v6.86 are prompt-complete but not yet deployed to Cloud Run.
Deploy queue: v6.85 → v6.86 (in order).

---

## Active Feedback / Known Issues (from visual review)

The following were identified during session review but deferred — address in next session
after visual review of v6.85/v6.86:

- Quotation surcharge line items for haulage — need visual verification after v6.85 deploy
- Edit Rate Card modal — verify all fields render correctly after v6.86 deploy

---

## Next Session Start

1. `list_directory` on handover + log folders
2. Read this handover + `AF-Test-Master.md` + prompt log head:25
3. Session header: `AF Dev — Session 136 | AcceleFreight v2 | v6.84 Live | v6.86 Prompt Ready | Tests v2.61 (272/286)`
4. First task: visual review of v6.85/v6.86 after deploy
5. Then continue haulage pricing workstream (surcharges, quotation calculation)

---

## Backlog

### 🔴 Next Up
- Deploy v6.85–v6.86 to Cloud Run + visual review
- Continue haulage pricing / quotation workstream

### 🟡 Queued
- Haulage price & cost calculation engine (briefing deferred from session 135)
- `fx_snapshot` population on quotation calculation
- Geography → Tax Rules admin UI
- Manual line item tax application
- `is_domestic` audit on DG Class Charges
- Air freight data migration
- AF-API-Pricing.md update (currency endpoints + haulage card schema not yet documented)

---

## Architecture Notes

### Haulage rate card schema (post-063)
| Column | Table | Notes |
|---|---|---|
| `currency` | `haulage_rate_cards` | Card-level, e.g. MYR |
| `uom` | `haulage_rate_cards` | Card-level, e.g. CONTAINER |
| `list_price` / `cost` | `haulage_rates` | Rate row level |
| `surcharges` | `haulage_rates` | JSONB `{code, description, amount}[]` |
| `side_loader_surcharge` | `haulage_rates` | Supplier cost row only |

### Surcharge resolution in quotation engine (post-v6.85)
- Union of list price surcharges + supplier surcharges by code
- Supplier-only surcharge → price = cost = supplier amount (pass-through at cost)
- Both sides have surcharge → price from list price, cost from supplier
- List-price-only surcharge → price = cost = list price amount

## Key File Paths

| File | State |
|---|---|
| `af-server/routers/pricing/haulage.py` | v6.86 — currency/uom on card |
| `af-server/routers/quotations.py` | v6.85 + v6.86 — surcharge fix + card currency |
| `af-server/migrations/063_haulage_card_currency_uom.sql` | Applied to prod ✓ |
| `af-platform/src/app/(platform)/pricing/haulage/_haulage-rate-modal.tsx` | v6.86 — no currency/uom |
| `af-platform/src/app/(platform)/pricing/haulage/_haulage-expanded-panel.tsx` | v6.86 — expanded card modal |
| `af-platform/src/app/(platform)/pricing/haulage/_haulage-rate-list.tsx` | v6.86 — pencil on hover |
| `af-platform/src/app/(platform)/pricing/haulage/_haulage-rate-cards-tab.tsx` | v6.86 — card edit wired |
| `af-platform/src/app/(platform)/pricing/_sparkline.tsx` | v6.85 — description label fix |
