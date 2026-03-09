# AF Dev Handover — Session 72 End
**Date:** 2026-03-09
**Version Live:** v5.55
**Last Prompt Executed:** v5.65 (completed this session)
**Tests:** v2.61 — 272/286 (unchanged this session)

---

## What Was Done This Session

### v5.63 — Local Charges + Customs Card View Redesign
- Backend: `GET /ports` + `GET /cards` added to `customs.py` (mirrors local_charges pattern)
- Card key: `port_code|trade_direction|shipment_type|charge_code|is_domestic`
- Frontend: `CustomsRateCard`, `CustomsRateTimeSeries` types + fetch actions added to `pricing.ts`
- `_local-charges-table.tsx` — removed expand/collapse, removed direction filter dropdown, added effective date label, collapsible IMP/EXP section headers
- `_customs-table.tsx` — full rewrite as `CustomsRatesTab` card view, "Add Rate" button opens CustomsModal
- `customs/page.tsx` — imports `CustomsRatesTab`

### Rate Data Consolidation — Executed on Prod
- `af-server/scripts/consolidate_rates.py` — collapses consecutive identical monthly rows into single effective-date-range rows
- `local_charges`: 52,784 → 1,143 rows (97.8% reduction)
- `customs_rates`: 16,929 → 358 rows (97.9% reduction)

### Open-End Rates Fix
- `af-server/scripts/openend_rates.py` — sets `effective_to = NULL` on latest active row per card group where `effective_to = 2026-02-28`
- `local_charges`: 766 rows open-ended
- `customs_rates`: 260 rows open-ended

### Badge/UI Polish (MCP direct)
Applied to both `_local-charges-table.tsx` and `_customs-table.tsx`:
- IMP/EXP badge shortening with full-label tooltip
- All badges (direction, type, container, DOM, PWF, UOM) have `title` + `cursor-help`
- UOM moved to badge row (removed standalone text line)
- Shipment type wildcard filter: selecting FCL/LCL/etc shows that type + ALL cards; `ALL` removed from dropdown

### v5.65 — Edit Rate from Card Row
- `_local-charges-table.tsx`: added `Pencil`/`Plus` imports, `modalOpen`/`editRate`/`editRateId` state, `handleSave` branching create vs update, "Add Rate" button in filter bar, `LocalChargesModal` rendered, `onEdit` prop threaded to `LocalChargeCardList`, pencil button on hover in identity panel
- `_customs-table.tsx`: added `Pencil` import, `editRateId` state, updated `onSave` to branch create/update via `createCustomsRateAction`/`updateCustomsRateAction`, `onEdit` prop threaded to `CustomsCardList`, pencil button on hover in identity panel, `onClose` clears `editRateId`

---

## Immediate Next Steps

1. **Browser test** — verify:
   - Hovering a local charges or customs card row reveals pencil icon
   - Clicking pencil opens modal pre-filled with correct data
   - Saving calls PATCH (not POST) and card refreshes
   - "Add Rate" button still opens empty modal
   - Shipment type wildcard filter: FCL shows FCL + ALL cards
   - March 2026 now shows data (open-ended rates fix)

2. **Deploy to prod** — v5.63 + all MCP badge/filter edits + v5.65

3. **Flip `DRY_RUN = True`** in:
   - `af-server/scripts/migrate_local_charges.py` (line ~25)
   - `af-server/scripts/migrate_customs_charges.py` (line ~25)

4. **Commit** `openend_rates.py` + badge/filter edits + v5.65 changes

---

## Migrations State

| # | File | Local | Prod |
|---|---|---|---|
| 020 | `020_lcl_min_quantity.sql` | YES | YES |
| 021 | `021_thc_customs_rates.sql` | YES | YES |
| 022 | `022_customs_port_code.sql` | YES | YES |
| 023 | `023_local_charges.sql` | YES | YES |
| 024 | `024_local_charges_uom.sql` | YES | YES |
| 025 | `025_customs_rates_price_cost.sql` | YES | YES |

---

## Data Migration State

| Script | Status | Rows |
|---|---|---|
| `migrate_local_charges.py` | ✅ Complete | 60,994 inserted → consolidated to 1,143 |
| `migrate_customs_charges.py` | ✅ Complete | 16,929 inserted → consolidated to 358 |
| `consolidate_rates.py` | ✅ Complete | Both tables consolidated |
| `openend_rates.py` | ✅ Complete | 766 + 260 rows open-ended |

---

## Known Issues / Watch Items
- `migrate_local_charges.py` `DRY_RUN` still `False` — needs manual flip
- `migrate_customs_charges.py` `DRY_RUN` still `False` — needs manual flip
- v5.65 browser test not yet confirmed

---

## Active Prompt
`PROMPT-CURRENT.md` — contains completed v5.65. Safe to overwrite for next prompt.

---

## Backlog / Deferred
- Ground transportation design — not yet scoped
- Geography → Pricing → Quotation workstream — pricing module in progress
- Operations Playbook — deferred (Jermaine to participate)
- AI agent phases — deferred until core platform complete

---

## Architecture Reminders
- `shipments.etd` / `shipments.eta` deprecated; POL/POD task legs are source of truth
- BC writes scheduled timing only; BL/AWB writes actual timing only
- Forward-only status progression
- All shipment records use `AF-` prefix; `AFCQ-` retired
- af-web (Vue public site) parked indefinitely
