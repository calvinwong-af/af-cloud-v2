# AF Dev Handover — Session 135 End
**Date:** 2026-03-15
**Session:** 135
**Version at close:** v6.88 (prompt complete, pending deploy)
**Live on Cloud Run:** v6.84
**Tests:** v2.61 (272/286)

---

## Session Summary

Session focused entirely on the haulage pricing module — four prompts plus one direct MCP
edit (currency page UI). All migrations applied to prod.

### Prompts completed this session

- **v6.85** — Haulage surcharge fixes: `HaulageRateCardEditModal` added; sparkline tooltip
  shows surcharge description instead of code; `_resolve_haulage` surcharge loop rewritten
  to union list price + supplier surcharges (supplier-only passes through at cost).

- **v6.86** — `currency` + `uom` migrated from rate rows to rate card level. Migration 063
  applied. Full backend + frontend refactor. `_resolve_haulage` in `quotations.py` updated
  to read currency from card row.

- **v6.87** — Haulage UI/UX: icon buttons (Pencil + Trash2 matching local charges pattern),
  delete card endpoint + action, rate row delete with inline confirm, area name as primary
  display, port as secondary, column header → "Area / Container", "Set end date" removed,
  "Update" → "Add rate", UI-18 cross-module audit added to backlog.

- **v6.88** — `is_tariff_rate` flag on rate cards (migration 064 applied); FAF calculation
  engine in `_resolve_haulage` — `_resolve_faf_percent` helper resolves active FAF % from
  `haulage_faf_rates` JSONB, emits `HA-FAF` line item post-rebate; FAF % badge on supplier
  rows in expanded panel; "Tariff" badge on card rows.

### Direct MCP edit (no Opus)

- **Currency page** (`pricing/currency/page.tsx`): identity column decluttered (removed rate
  value + currency badges), columns narrowed 80px → 60px for density, current week column
  highlighted with solid sky header + stronger cell tint + bold sky rate value, text search
  filter added to toolbar.

### Migrations applied to prod

| Migration | Description | Status |
|---|---|---|
| 063 | `currency`/`uom` → `haulage_rate_cards`; dropped from `haulage_rates` | ✅ Applied |
| 064 | `is_tariff_rate BOOLEAN NOT NULL DEFAULT FALSE` on `haulage_rate_cards` | ✅ Applied |

---

## Pending Deploy

All of v6.85–v6.88 are prompt-complete, both migrations applied. Ready to deploy as a batch.
Deploy order: v6.85 → v6.86 → v6.87 → v6.88.

---

## Architecture Notes (post-session state)

### Haulage rate card schema (post-063 + post-064)

| Column | Type | Notes |
|---|---|---|
| `currency` | VARCHAR(10) NOT NULL | Card-level, e.g. MYR — moved from rate rows in 063 |
| `uom` | VARCHAR(20) NOT NULL | Card-level, e.g. CONTAINER — moved from rate rows in 063 |
| `is_tariff_rate` | BOOLEAN NOT NULL DEFAULT FALSE | Added in 064 |
| `include_depot_gate_fee` | BOOLEAN | Existing |
| `side_loader_available` | BOOLEAN | Existing |
| `is_active` | BOOLEAN | Existing |

### Surcharge resolution in quotation engine (post-v6.85)
- Union of list price + supplier surcharges by code
- Supplier-only → price = cost = supplier amount
- Both sides → price from list price, cost from supplier
- List-price-only → price = cost = list price amount

### FAF calculation in quotation engine (post-v6.88)
- `_resolve_faf_percent(conn, supplier_id, port, size, ref_date)` helper
- Looks up latest published `haulage_faf_rates` row for supplier
- Matches `port_rates` JSONB by `port_un_code` + `container_size` (wildcard fallback)
- Applied **after rebate** on base cost: `faf_cost = cost_val * faf_pct`
- Emits `HA-FAF` line item with price = cost = faf_cost (pass-through)
- If no active FAF row → skipped silently

---

## Next Session Start

1. `list_directory` on handover + log folders
2. Read this file + `AF-Test-Master.md` + prompt log head:25
3. Session header: `AF Dev — Session 136 | AcceleFreight v2 | v6.84 Live | v6.88 Prompt Ready | Tests v2.61 (272/286)`
4. First task: deploy v6.85–v6.88 + visual review
5. Then: continue haulage workstream or move to next module per backlog

---

## Backlog Highlights

### 🔴 Next Up
- Deploy v6.85–v6.88 batch + visual review
- Haulage price & cost calculation engine briefing (deferred from session start — Calvin has design)

### 🟡 Queued (from backlog)
- UI-18: Cross-module UI audit (FCL/LCL/Air to match haulage patterns)
- `fx_snapshot` population on quotation calculation
- Geography → Tax Rules admin UI
- `is_domestic` audit on DG Class Charges
- Air freight data migration
- AF-API-Pricing.md update (haulage card schema + currency endpoints)

---

## Key File Paths (changed this session)

| File | State |
|---|---|
| `af-server/routers/pricing/haulage.py` | v6.88 — is_tariff_rate + DELETE card endpoint |
| `af-server/routers/quotations.py` | v6.88 — FAF helper + HA-FAF line item |
| `af-server/migrations/063_haulage_card_currency_uom.sql` | Applied ✓ |
| `af-server/migrations/064_haulage_is_tariff_rate.sql` | Applied ✓ |
| `af-platform/src/app/actions/pricing.ts` | v6.88 — is_tariff_rate + FafRate types |
| `af-platform/src/app/(platform)/pricing/haulage/_haulage-rate-modal.tsx` | v6.86 |
| `af-platform/src/app/(platform)/pricing/haulage/_haulage-expanded-panel.tsx` | v6.88 |
| `af-platform/src/app/(platform)/pricing/haulage/_haulage-rate-list.tsx` | v6.88 |
| `af-platform/src/app/(platform)/pricing/haulage/_haulage-rate-cards-tab.tsx` | v6.87 |
| `af-platform/src/app/(platform)/pricing/currency/page.tsx` | MCP direct — dense layout + search |
