# Handover — Session 123 End
**Date:** 2026-03-13
**Prompt Version at handover:** v6.45 (last prompt run) — v6.46 is next
**Tests:** v2.61 (272/286) — no changes this session
**Live on Cloud Run:** v6.38
**Complete, pending deploy:** v6.39, v6.40, v6.41, v6.42, v6.43, v6.44, v6.45

---

## Session Summary

Session 123 completed the DG pricing gap across two sub-gaps. All work was coding/migration — no design-only sessions.

### Prompts run this session

| Prompt | Description | Migration | Files |
|---|---|---|---|
| v6.42 | Container size normalisation fix (3 resolvers) | None | `quotations.py` |
| v6.43 | `local_charges` DG dimension — migration + engine | 049 ✅ applied | `049_local_charges_dg.sql`, `quotations.py` |
| v6.44 | `local_charges` router updated for `dg_class_code` | None | `routers/pricing/local_charges.py` |
| v6.45 | `dg_class_charges` table — migration + engine | 050 ❌ not yet applied | `050_dg_class_charges.sql`, `quotations.py` |

---

## Key Decisions Made This Session

### `local_charges` DG dimension (v6.43/v6.44)
- Added `dg_class_code VARCHAR(10) NOT NULL DEFAULT 'NON-DG'` to `local_charges`
- CHECK: `IN ('NON-DG', 'DG-2', 'DG-3', 'ALL')`
- Backfill: `LC-THC` rows → `'NON-DG'`; all other charge codes → `'ALL'`
- `lc_unique` constraint rebuilt to include `dg_class_code`
- `_resolve_local_charges`: filters `dg_class_code IN (:dg, 'ALL')`, ORDER BY CASE prefers exact match
- Dedup key excludes `dg_class_code` intentionally — ORDER BY ensures exact match wins

### `dg_class_charges` new table (v6.45)
- Entirely separate table from `local_charges` — DG charges always require exact `dg_class_code` match
- `dg_class_code` CHECK: `IN ('DG-2', 'DG-3')` — no `ALL` wildcard, no `NON-DG`
- No `paid_with_freight` — DG charges always separately billed (handled as custom surcharges at freight level)
- `component_type` = `export_dg` / `import_dg` — separate from `export_local` / `import_local`
- Warning emitted when no DG charges found (consistent with all other resolvers)
- Sort order: 22 (EXPORT), 23 (IMPORT) — after local charges (20/21), before customs (30/31)
- `_resolve_dg_class_charges` hooked into `calculate_quotation` as step D2

---

## Next Actions (Session 124)

1. **Create `run_migration_050.py`** — same pattern as `run_migration_049.py`, apply migration 050 to prod
2. **Write + run v6.46** — CRUD router for `dg_class_charges` (`af-server/routers/pricing/dg_class_charges.py`)
   - Same structure as `local_charges.py` router
   - `_SELECT`, `_row_to_dict`, `list_cards`, `list_rates`, `get_rate`, `create`, `update`, `delete`
   - Register in `main.py` under `/api/pricing/dg-class-charges`
3. **Write `migrate_dg_class_charges.py`** — pull legacy Datastore `PT-DGC-CHARGES` + `PTMonthlyRatePortCharges` data into PostgreSQL `dg_class_charges`
4. **Deploy batch v6.39–v6.46** once all parts complete

---

## Pending Deploy Queue

| Version | Description | Status |
|---|---|---|
| v6.39 | Pricing engine backend | Complete, not deployed |
| v6.40 | Quotation detail frontend + currency fix | Complete, not deployed |
| v6.41 | Local charges + customs filtering fix | Complete, not deployed |
| v6.42 | Container size normalisation (3 resolvers) | Complete, not deployed |
| v6.43 | `local_charges` DG dimension — migration + engine | Complete, not deployed |
| v6.44 | `local_charges` router `dg_class_code` | Complete, not deployed |
| v6.45 | `dg_class_charges` table + engine | Complete, not deployed |

---

## Migration Status

| Migration | Description | Status |
|---|---|---|
| 049 | `local_charges` dg_class_code dimension | ✅ Applied to prod |
| 050 | `dg_class_charges` table | ❌ Not yet applied |

---

## Files to Read at Session Start

- `claude/handover/handover-2026-03-13-session-end-v645.md` (this file)
- `claude/tests/AF-Test-Master.md`
- `claude/prompts/log/PROMPT-LOG-v6.41-v6.50.md` (tail:25)
- `af-server/scripts/run_migration_049.py` (template for run_migration_050.py)
- `af-server/routers/pricing/local_charges.py` (template for v6.46 router)

---

## Test Status
- **v2.61** — 272/286 passing — no changes this session
- No new test series needed yet; DG class charges require manual testing via calculate endpoint once data migration is complete
