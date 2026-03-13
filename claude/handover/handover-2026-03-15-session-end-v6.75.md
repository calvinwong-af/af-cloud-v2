# Handover — Session 132 End — v6.75

**Date:** 2026-03-15  
**Session:** 132  
**Live version:** v6.73 (deployed) — v6.74 and v6.75 pending deploy  
**Latest prompt:** v6.75 (complete, not yet deployed)  
**Tests:** v2.61 (272/286)

---

## Session Summary

This session completed the pricing module UX polish series (v6.73–v6.74) and fixed a critical customs pricing bug (v6.75).

---

## What Was Completed This Session

### v6.74 — UOM Abbreviation + New Rate Modal UX Fix ✓
Two changes across 6 frontend files (3 table + 3 modal — customs, local-charges, dg-class-charges):

1. **CTR abbreviation:** `UOM_DISPLAY` map added; `CONTAINER` renders as `CTR` in badge and `<option>` labels. Stored value unchanged.
2. **New rate modal UX:** When `mode === 'new' && seed` (Plus button / empty cell), shows read-only card identity header instead of editable card fields. Title becomes `New Rate — {charge_code}`. Card fields sourced from seed in handleSubmit via `seed?.field ?? stateField`.

### v6.75 — Customs Pricing UOM Fix ✓
**Bug:** `_resolve_customs` in `quotations.py` hardcoded `"uom": "SHIPMENT"` and `"quantity": 1` for all customs line items, ignoring the actual `uom` stored on `customs_rate_cards`. A `CONTAINER` UOM customs charge on a 5-container FCL shipment billed once instead of 5×.

**Fix:** Replaced the hardcoded block with full UOM-aware quantity resolution matching `_resolve_local_charges` / `_resolve_dg_class_charges`. CONTAINER sums all containers (no size/type filter — customs cards have no container dimension). LCL and AIR handle CBM/W/M/KG/CW_KG. All others default to `1.0`. The `crc.uom` column was already in the SQL SELECT at index `r[6]` — just never used.

---

## Pending Deploy

v6.74 and v6.75 are both complete but not yet deployed to Cloud Run. Both are backend + frontend changes:
- v6.74: frontend only (6 files)
- v6.75: backend only (`af-server/routers/quotations.py`)

Deploy both together in the next session.

---

## Current State of Key Files

| File | State |
|------|-------|
| `af-server/routers/quotations.py` | v6.75 — UOM-aware customs qty resolution |
| `af-platform/src/app/(platform)/pricing/customs/_customs-modal.tsx` | v6.74 — CTR abbrev, seeded new-rate header |
| `af-platform/src/app/(platform)/pricing/customs/_customs-table.tsx` | v6.74 — CTR abbrev |
| `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-modal.tsx` | v6.74 |
| `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-table.tsx` | v6.74 |
| `af-platform/src/app/(platform)/pricing/dg-class-charges/_dg-class-charges-modal.tsx` | v6.74 |
| `af-platform/src/app/(platform)/pricing/dg-class-charges/_dg-class-charges-table.tsx` | v6.74 |
| Migrations | 055–058 applied to prod ✓ — next must be 059+ |

---

## Open Items / Backlog (priority order)

1. **[NEXT]** Deploy v6.74 + v6.75 to Cloud Run
2. **[NEXT]** Continue bug review — Calvin indicated more errors to go through
3. **[PENDING]** Geography → Tax Rules admin UI — `tax_rules` table management
4. **[PENDING]** Manual line item tax — apply tax on manually added items by component_type + port country
5. **[PENDING]** `is_domestic` audit on DG Class Charges — many rows tagged `is_domestic = true` from original migration
6. **[PENDING]** AF-API-Pricing.md — update after frontend rewrites stabilise
7. **[PENDING]** Air freight data migration — next major workstream after pricing module complete

---

## Architecture Reference (locked)

**Rate row standard:** `id`, `rate_card_id`, `price`, `cost`, `effective_from`, `effective_to`, `created_at`, `updated_at` only.

**Card key formats:**
- `customs_rate_cards` — 6-part: `{port_code}|{trade_direction}|{shipment_type}|{charge_code}|{is_domestic}|{is_international}`
- `local_charge_cards` — 9-part: `{port_code}|{trade_direction}|{shipment_type}|{container_size}|{container_type}|{dg_class_code}|{charge_code}|{is_domestic}|{is_international}`
- `dg_class_charge_cards` — 9-part: same as local charges

**Modal pattern (v6.70+, consistent across all 3 modules):**
- 3 modes: `'new'` / `'edit-rate'` / `'edit-card'`
- `'new'` with seed → read-only card header + rate fields only (v6.74)
- `'new'` without seed → full editable form
- Button order: `Pencil | Plus | CreditCard | Trash`
- UOM badge: `CONTAINER` stored, `CTR` displayed (v6.74)

**Resolver pattern in `_resolve_customs` (v6.75):**
- `CONTAINER` + FCL → sum all container quantities (no size/type filter)
- `CBM`/`W/M`/`KG` + LCL → from shipment weight/volume
- `CW_KG`/`KG`/`CBM` + AIR → from shipment chargeable weight / weight / cbm
- All others → `1.0`

---

## Session Startup Checklist (Session 133)

```
read_multiple_files:
  - claude/handover/handover-2026-03-15-session-end-v6.75.md   ← this file
  - claude/tests/AF-Test-Master.md
  - (log already read this session — tail:5 to confirm nothing new)
```

**Session header:**
`AF Dev — Session 133 | AcceleFreight v2 | v6.73 Live | v6.75 Latest | Tests v2.61 (272/286)`

**First actions:**
1. Deploy v6.74 + v6.75
2. Continue bug review from Calvin
