# Session 46 Handover — AcceleFreight v2
**Date:** 2026-03-07
**Version:** v5.11 Deployed to Prod (deploy in progress end of session) | v5.12 Not yet written
**Tests:** 272/286 (v2.61 — no changes this session)
**Session Type:** Migration debug + pricing data migration + cleanup

---

## Session Work

### Root Cause: Migration 014 DDL Never Persisted
All previous attempts to apply migration 014 silently rolled back. Root cause confirmed:
- SQLAlchemy opens connections in **autobegin** mode (implicit transaction)
- `conn.connection.cursor().execute(sql)` and `engine.raw_connection()` both operate inside SQLAlchemy's transaction boundary
- DDL appeared to succeed within the same connection (verification queries inside the same session saw the column), but rolled back on connection close
- `conn.commit()` and `engine.dispose()` did not resolve this — SQLAlchemy's transaction state was already active

**Fix:** Rewrote `run_migration_014.py` to use a **pure psycopg2 connection** built directly from `DATABASE_URL`, completely bypassing SQLAlchemy and its pool. `autocommit = True` set on the raw connection before DDL execution. Verification runs on a second independent psycopg2 connection opened after the first is fully closed.

**Pattern for future migration runners:** All `run_migration_0xx.py` scripts must use direct psycopg2 with `autocommit = True` for DDL — never SQLAlchemy connections for schema changes.

### Migration 014 — Applied to Prod ✅
`run_migration_014.py` executed successfully:
- `port_terminals` table created and seeded: 2 rows (MYPKG_N = Northport, MYPKG_W = Westports)
- `terminal_id` column added to `fcl_rate_cards` and `lcl_rate_cards`
- Note: `localhost:5432` connects via Cloud SQL Auth Proxy — this IS prod

### Pricing Migration — Complete on Prod ✅
`migrate_pricing_freight.py` executed successfully:
- FCL rate cards: 408
- LCL rate cards: 211
- FCL rates migrated: 16,632
- LCL rates migrated: 8,801
- Skipped (pre-2024 or invalid date): 39,777
- Skipped (no matching rate card): 52
- Warnings (currency/UOM defaults applied): 19,466

### Pricing Deduplication — Complete on Prod ✅
`cleanup_pricing_duplicates.py` executed successfully:
- FCL duplicates deleted: 15,969
- LCL duplicates deleted: 8,448
- Total deleted: 24,417 (96% of migrated rows — monthly rollover duplicates)
- **FCL rates retained: 663**
- **LCL rates retained: 353**

### v5.11 Deployment
Calvin deploying to Cloud Run at end of session. Code changes in v5.11:
- `GET /geography/port-terminals` and `GET /geography/port-terminals/{terminal_id}` endpoints
- `terminal_id` on FCL/LCL rate card models, SELECT, INSERT, UPDATE

---

## Next Session Focus

### Pricing UI Design (af-platform)
Design session for the pricing management interface. Key areas:
- FCL rate card list + rate history view
- LCL rate card list + rate history view
- Terminal-aware display (MYPKG_N / MYPKG_W distinction)
- Rate card create/edit (including terminal_id selection)
- Rate history entry (effective_from date, cost/price fields)

### Backlog (carry forward)
- Delete retired route stubs (`shipments/` and `ground-transport/` old routes)
- Route migration: `shipments/[id]` → `orders/shipments/[id]`, `ground-transport/[id]` → `orders/deliveries/[id]`
- New GT test series
- UI-01: Keyboard arrow navigation on combobox/dropdowns
- UI-02/04: Port list filtered by freight type in PortEditModal

---

## MCP Edits This Session

### `af-server/scripts/run_migration_014.py` (rewritten)
- Replaced SQLAlchemy-based DDL execution with direct psycopg2 connection
- Parses `DATABASE_URL` from env directly, strips `+psycopg2` driver prefix
- `autocommit = True` on raw psycopg2 connection for DDL
- Verification on a separate independent psycopg2 connection

### `af-server/scripts/migrate_pricing_freight.py`
- Added `get_engine.cache_clear()` before `get_engine()` in `main()`
- Added `engine.dispose()` after `get_engine()` in `main()`
- Note: these additions are harmless but were not the actual fix — the real fix was in the migration runner

### `af-server/scripts/check_schema.py` (NEW — diagnostic)
- Standalone schema verification script
- Can be deleted — single-use diagnostic, no longer needed

---

## Key Architecture Notes (carry forward)

### DDL Migration Pattern (new — established this session)
All future migration runner scripts must use direct psycopg2 with autocommit for DDL:
```python
import psycopg2, re
dsn = re.sub(r"\+psycopg2", "", os.environ["DATABASE_URL"])
conn = psycopg2.connect(dsn)
conn.autocommit = True
conn.cursor().execute(sql)
conn.close()
```
Never use SQLAlchemy connections for DDL in migration scripts.

### Pricing Data Shape (post-cleanup)
- 408 FCL rate cards, 211 LCL rate cards
- 663 FCL rates, 353 LCL rates (distinct rate changes only, effective_from = first month that rate applied)
- Monthly rollover duplicates eliminated — 96% reduction
- Currency defaults: MY-MY lanes → MYR, all others → USD

### Indian ICD Port Codes (carry forward)
Indian inland depots use 6-digit ICEGATE codes (e.g. `INWFD6`) as primary identity — not terminal suffixes. Do not apply terminal normalisation to Indian `*6` codes.

---

## File Locations
- Active prompt: `claude/prompts/PROMPT-CURRENT.md` (v5.11 executed — v5.12 not yet written)
- Prompt log: `claude/prompts/log/PROMPT-LOG-v5.11-v5.20.md`
- Tests master: `claude/tests/AF-Test-Master.md` (v2.61 — 272/286)
- Migration runner: `af-server/scripts/run_migration_014.py` (rewritten this session)
- Pricing migration: `af-server/scripts/migrate_pricing_freight.py`
- Cleanup script: `af-server/scripts/cleanup_pricing_duplicates.py`
- Diagnostic (deletable): `af-server/scripts/check_schema.py`
