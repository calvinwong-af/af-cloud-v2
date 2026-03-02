# AF Handover Notes — v2.36
**Date:** 03 March 2026
**Test List Version:** v2.45
**Session Focus:** Port Terminal Layer (PT series) — complete data migration, backfill, and frontend verification

---

## Session Summary

This session completed the Port Terminal Layer end-to-end: Datastore migration, PostgreSQL seeding, V1 data backfill, and full frontend verification across all PT tests. Two additional backfill scripts were required to fix gaps in earlier migration logic.

---

## Completed This Session

### 1. seed_port_terminals.py — Bug Fix
- **Issue:** `::jsonb` cast syntax in SQLAlchemy `text()` caused `SyntaxError` — colon treated as bind parameter prefix
- **Fix:** Replaced `:terminals::jsonb` with `CAST(:terminals AS jsonb)`
- **Result:** 17 ports upserted cleanly, idempotent

### 2. backfill_v1_ports.py — Executed (PT-04 completion)
- Script was already created by Opus (v2.65 prompt log)
- Dry run: 2,032 updates, 0 errors
- Live run: 2,032 updated, 2 skipped, 0 errors
- Reads nested `origin.port_un_code` / `destination.port_un_code` from Datastore ShipmentOrder
- Maps AFCQ- → AF- IDs and writes `origin_port`, `origin_terminal`, `dest_port`, `dest_terminal` to PostgreSQL

### 3. backfill_v1_terminals.py — New Script (gap fix)
- **Root cause:** `backfill_v1_ports.py` only targeted rows where `origin_port IS NULL OR dest_port IS NULL` — missed 1,495 records where port was already set but terminal was NULL
- These records had `terminal_id` in Datastore (set by `migrate_v1_port_codes.py`) but it wasn't carried across
- **Fix:** New script targets `migrated_from_v1 = TRUE` rows where port is set but terminal is NULL
- Uses `COALESCE(existing, new)` to avoid overwriting already-correct terminals
- **Result:** 1,495 records updated — all V1 records now have correct terminal assignments in PostgreSQL

### 4. PT Frontend Tests — All Passed
| Test | Result | Record |
|------|--------|--------|
| PT-09 | ✅ | AF-003794 — MYPKG with "Northport" sub-label |
| PT-10 | ✅ | AF-003837 — MYPKG with "Westports" sub-label |
| PT-11 | ✅ | AF-003794 — Tooltip: "Port Klang (Northport), Malaysia" |
| PT-12 | ✅ | AF-003837 — Tooltip: "Port Klang (Westports), Malaysia" |
| PT-13 | ✅ | AF-003837 — CNSHK tooltip correct (regression) |

---

## Current Data State

### PostgreSQL — shipments table
- Total records: ~2,034 V1 + ~10 V2 native
- `origin_port` / `dest_port`: populated for all V1 records
- `origin_terminal` / `dest_terminal`: populated for all records where terminal applies
  - MYPKG_N (Northport): set explicitly from Datastore
  - MYPKG_W (Westports): set as default for plain MYPKG records
  - Standard ports (CNSHK, SGSIN, etc.): terminal = NULL (correct)

### PostgreSQL — ports table
- 17 ports seeded via `seed_port_terminals.py`
- MYPKG has 2 terminals: MYPKG_W (Westports, default) and MYPKG_N (Northport)

### Datastore — ShipmentOrder
- All 4,345 MYPKG records updated by `migrate_v1_port_codes.py`:
  - MYPKG_N suffix → `port_un_code=MYPKG`, `terminal_id=MYPKG_N`
  - Plain MYPKG → `port_un_code=MYPKG`, `terminal_id=MYPKG_W`
- Migration marker `_migrated_port_codes=True` on all updated records

---

## Scripts Created This Session

| Script | Purpose | Status |
|--------|---------|--------|
| `af-server/scripts/backfill_v1_terminals.py` | Backfill missing terminal_id for V1 records where port set but terminal NULL | Run — 1,495 updated |
| `af-server/scripts/inspect_003837.py` | One-off diagnostic — inspect AFCQ-003837 Datastore fields | Disposable |

---

## Known Issues / Notes

- `inspect_003837.py` is a disposable diagnostic script — can be deleted
- IATA airport codes (KUL, PEK, SIN, etc.) remain in Datastore as non-LOCODE port codes for air shipments — flagged in audit but not blocking; separate data quality issue to address later
- 2 records skipped in backfill_v1_ports (1 already had data, 1 had no PostgreSQL row) — not a concern

---

## Environment State

- Local development: fully operational
  - ADC authenticated (`gcloud auth application-default login`)
  - Cloud SQL Auth Proxy running (`tools\start-proxy.bat`)
  - `af-server/.env.local` includes `DATABASE_URL`
- Production: deployed on Google Cloud Run (appv2.accelefreight.com / api.accelefreight.com)
- No deployments made this session — all changes were data/script only

---

## Test List Status

- Test list: v2.45
- PT series: **ALL COMPLETE** (PT-01 through PT-13, all YES)
- AUTH series: complete (AUTH-01/02 NA by design, AUTH-03/04/05 YES)
- BL series: complete through BL-30
- Next pending series: MB (Mobile) — deferred until mobile UX pass

---

## Recommended Next Steps

1. **Deploy** — no code changes pending; consider a production deploy to push any recent fixes
2. **MB series** — mobile responsiveness pass for af-platform and af-web
3. **New feature work** — options:
   - Incoterm task engine enhancements
   - BL parsing improvements
   - Port/terminal management UI (admin)
   - Create shipment flow improvements

---

## File Paths Reference

- Handover: `claude/handover/`
- Test list: `claude/tests/AF-Test-List.md`
- Prompt current: `claude/prompts/PROMPT-CURRENT.md`
- Prompt log: `claude/prompts/log/PROMPT-LOG-v2.63-v2.72.md`
- Other: `claude/other/`
