# AF Dev — Session End Handover
**Session:** 99
**Date:** 2026-03-11
**Version Live:** v5.69
**Last Prompt Executed:** v6.01
**Prompt Ready:** _None_
**Tests:** v2.61 — 272/286 passing (unchanged)

---

## What Happened This Session

### Haulage Migration — Closed ✅

Migration run 2 (MYPKG + MYPKG_N) completed successfully:
- 789 cards + 22,064 rate rows inserted to prod
- Combined totals: 939 cards + 25,984 rate rows
- Zero orphans, zero supplier validation errors
- `verify_haulage_migration.py` not explicitly run this session — totals confirmed from migration output

FAF check (`check_haulage_faf.py`) completed:
- FAF values exist on both Malaysian ports (MYPKG, MYPEN, MYPGU, MYBTU, MYTWU) and non-Malaysian ports (SGSIN, BEANR, AUSYD, SEGOT)
- All non-MY FAF entries are from 2019–2022 — pre-cutoff historical data only
- **Decision:** FAF is not migrated. It will be entered fresh when the haulage FAF feature is built. Feature scope is port-agnostic (not MY-only).

### Air Freight Pricing Module — In Progress

Full Datastore inspection completed (`inspect_air_pricing.py`). Schema designed and applied.

**Migration 040 applied to prod ✅:**
- `air_freight_rate_cards` — route + DG class + airline code dimensions
- `air_freight_rates` — 7 breakpoint tiers (l45/p45/p100/p250/p300/p500/p1000) + min + surcharges JSONB

**`migrate_air_pricing.py` created by Opus (v6.01) ✅** — not yet executed.

---

## Air Freight Data Summary (from inspection)

**PricingAir cards:** 196 total, 182 active (14 trashed)
- `pt_id` key format: `ORIGIN:DEST:DG_CLASS:AIRLINE_CODE` (string, not numeric)
- `dg_class_code` values: `NON-DG`, `DG-2`, `DG-3`
- Airline codes: plain VARCHAR, normalised to uppercase on migration
- Supplier IDs use `AFC-` prefix — already valid in companies table, no remap needed

**PTMonthlyRateOceanAir (PT-AIR) rate rows:** 11,488 total
- 5,730 price rows / 5,758 cost rows
- UOM: `CW` (chargeable weight) — keep; `CTR` (34 rows, single card `KUL:NKG:NON-DG:CI`) — exclude
- Cutoff: `2024-01-01`
- Surcharge fields: `fsc`, `msc`, `ssc` in `charges` dict

---

## Immediate Next Steps (Start of Next Session)

1. **Dry run air migration:**
   ```
   .venv\Scripts\python scripts\migrate_air_pricing.py --dry-run
   ```
   Expected: ~182 cards, ~6,460 CW rows post-cutoff filter (exact count TBD from dry run)

2. **Live run** once dry run is clean

3. **Write `verify_air_migration.py`** — post-migration verification (same pattern as haulage)

4. **Air freight pricing UI + router** — next workstream after migration confirmed

---

## Deferred (unchanged)

- Haulage module UI (rate cards list, DGF badge, supplier rebates on company profile)
- Haulage FAF feature — port-agnostic, data entered fresh (no migration)
- Quotation module (next major workstream after all pricing migrations complete)
- Gen transport + cross-border transport — schema ready, no data
- Operations Playbook
- AI agent phases
- TD-02: drop deprecated flat surcharge columns
- UI-17: per-user country preference

---

## Scripts Created This Session

| Script | Purpose |
|---|---|
| `af-server/scripts/inspect_air_pricing.py` | Datastore inspection — air freight cards + rate rows |
| `af-server/scripts/check_haulage_faf.py` | FAF port analysis — confirmed port-agnostic, no migration needed |
| `af-server/scripts/run_migration_040.py` | Migration runner — applied 040 to prod |
| `af-server/scripts/migrate_air_pricing.py` | Air freight migration script (Opus v6.01) — not yet run |

## Migrations Applied This Session

| Migration | Status |
|---|---|
| `037_haulage_pricing.sql` | Applied (prev session) |
| `038_haulage_supplier_rebates.sql` | Applied (prev session) |
| `039_supplier_fk_retrofit.sql` | Applied (prev session) |
| `040_air_freight_pricing.sql` | Applied this session ✅ |
