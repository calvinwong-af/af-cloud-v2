# Session 45 Handover — AcceleFreight v2
**Date:** 2026-03-07
**Version:** v5.10 Live on Prod | v5.11 Complete (not yet deployed) | v5.12 Pending
**Tests:** 272/286 (v2.61 — no changes this session)
**Session Type:** Migration execution + pricing pre-flight

---

## Session Work

### v5.11 — Confirmed Complete
Opus executed v5.11 successfully. All six deliverables confirmed in `PROMPT-LOG-v5.11-v5.20.md`:
- `migrations/014_port_terminals.sql` — port_terminals table + terminal_id on rate cards
- `scripts/run_migration_014.py` — migration runner
- `geography.py` — GET /port-terminals + GET /port-terminals/{terminal_id}
- `pricing/fcl.py` + `pricing/lcl.py` — terminal_id in models/SELECT/INSERT/UPDATE
- `migrate_pricing_freight.py` — _PORT_TERMINAL_MAP + _get_terminal_id()

### Migration 014 — Run Locally ✅
`run_migration_014.py` executed successfully on local DB:
- `port_terminals` seeded: 2 rows (MYPKG_N = Northport, MYPKG_W = Westports/default)
- `terminal_id` column confirmed on `fcl_rate_cards` and `lcl_rate_cards`

**Note:** Migration 014 runner had a bug (split-on-semicolon approach) — fixed via MCP to use `conn.connection.cursor().execute(sql)` for whole-file execution.

### Pricing Pre-flight Analysis — Complete
Ran `diagnose_pricing_warnings.py` and resolved all issues:

**Issue 1 — INTKD6 / INWFD6 (3 rate cards):**
- Indian ICD codes — INWFD6 = ICD Whitefield Bangalore, INTKD6 = Tughlakabad Delhi
- Indian naming convention: the 6-digit code IS the primary identity, not a terminal suffix
- `INWFD` missing from ports table entirely
- Decision: migrate as-is (raw TEXT, no FK constraint) — very low volume, deferred to future
- No code changes needed

**Issue 2 — Missing currency on FCL/LCL 2024+ records:**
- Fixed via MCP: added `_default_currency(pt_id)` helper to `migrate_pricing_freight.py`
- Rule: if both origin AND destination port codes start with `MY` → default MYR, else USD
- Logic verified in dry run — MYR correctly assigned to MY-MY lanes (e.g. MYPKG_N:MYTWU, MYKCH:MYPKG_N, etc.)

### Dry Run — Passed ✅
```
FCL rate cards: 408
LCL rate cards: 211
FCL rates: 16,632
LCL rates: 8,801
Skipped (pre-2024 or invalid date): 39,777
Skipped (no matching rate card): 52
Warnings: 19,466 (currency/UOM defaults — expected, MYR logic confirmed working)
```

### Full Migration — BLOCKED ❌
`migrate_pricing_freight.py` (full run, no --dry-run) fails with:
```
psycopg2.errors.UndefinedColumn: column "terminal_id" of relation "fcl_rate_cards" does not exist
```
This is anomalous — `run_migration_014.py` confirmed the column exists immediately before. Likely cause: connection caching or transaction isolation — the migration runner and the pricing script may be seeing different DB states. To investigate next session.

---

## Pending Work Queue

### Immediate (next session — debug)
1. **Debug `terminal_id` column not found** — investigate why `migrate_pricing_freight.py` can't see the column despite `run_migration_014.py` confirming it exists. Check:
   - Whether `run_migration_014.py` is committing properly (it does — `conn.commit()` is explicit)
   - Whether `migrate_pricing_freight.py` is connecting to a different DB (check `.env.local` vs any other env file)
   - Try: run `psql` directly and `\d fcl_rate_cards` to confirm column is actually persisted
   - Try: restart the pricing migration after a fresh terminal session
2. **Run full `migrate_pricing_freight.py`** once unblocked
3. **Run `cleanup_pricing_duplicates.py --dry-run`** then full run
4. **Pricing UI design session** — af-platform prototype (next after migration verified)

### After pricing migration verified
5. Deploy v5.11 to prod (migration 014 + pricing router updates)
6. Run `run_migration_014.py` on prod
7. Run `migrate_pricing_freight.py` on prod

### Backlog (active)
- Delete retired route stubs (`shipments/` and `ground-transport/` old routes)
- Route migration: `shipments/[id]` → `orders/shipments/[id]`, `ground-transport/[id]` → `orders/deliveries/[id]`
- New GT test series — write once revised GT module is stable
- UI-01: Keyboard arrow navigation on combobox/dropdowns
- UI-02/04: Port list filtered by freight type in PortEditModal

### Deferred
- Air freight rate cards — separate design session
- Quotation engine integration (Phase 2)
- `/orders/haulage` page design
- Ground transportation design
- Operations Playbook (Jermaine)
- AI agent phases (all post-core)

---

## MCP Edits This Session

### `af-server/scripts/run_migration_014.py`
- Fixed SQL execution: replaced `split(";")` loop with `conn.connection.cursor().execute(sql)` — whole-file execution via psycopg2 directly

### `af-server/scripts/migrate_pricing_freight.py`
- Added `_MY_PREFIX = "MY"` constant
- Added `_default_currency(pt_id)` helper — parses `ORIGIN:DEST:...` key, returns `MYR` if both ports start with `MY`, else `USD`
- Updated FCL missing-currency default: `currency = _default_currency(pt_id)`
- Updated LCL missing-currency default: `currency = _default_currency(pt_id)`
- Updated warning log messages to show actual currency assigned

### `af-server/scripts/check_india_ports.py` (NEW)
- Diagnostic script to check parent ports + port_terminals for INTKD/INWFD codes
- Can be deleted after next session — single-use diagnostic

---

## Key Architecture Notes

### Indian ICD Port Codes
Indian inland container depots use a 6-digit ICEGATE code (e.g. `INWFD6`) as their primary identity — NOT a terminal suffix on a 5-char parent port. This is different from the Malaysian terminal pattern (`MYPKG_N` = terminal on `MYPKG`). Do not apply terminal normalisation to Indian `*6` codes.

### Currency Rules (locked in)
- MY-MY lanes (both ports `MY` prefix): MYR
- All other lanes: USD
- Applies only as a default when Datastore record has no currency set

### Port Terminals Design (recap)
- `port_terminals` table: first-class rows with FK from `ports`
- `terminal_id` nullable on rate card tables — NULL = no terminal distinction
- MYPKG: NP rates → `terminal_id = MYPKG_N`, WP rates → `terminal_id = MYPKG_W`
- Quotation: fetch all rate cards for `port_code`, order by cost ASC, cheapest wins, winning `terminal_id` informs departure terminal

---

## File Locations
- Active prompt: `claude/prompts/PROMPT-CURRENT.md` (v5.11 — executed, v5.12 not yet written)
- Prompt log: `claude/prompts/log/PROMPT-LOG-v5.11-v5.20.md`
- Tests master: `claude/tests/AF-Test-Master.md` (v2.61 — 272/286)
- Diagnostic script: `af-server/scripts/diagnose_pricing_warnings.py` (complete — keep for reference)
- Check script: `af-server/scripts/check_india_ports.py` (single-use — can delete)
- Migration (local only): `af-server/migrations/014_port_terminals.sql`
- Pricing migration: `af-server/scripts/migrate_pricing_freight.py` (updated this session)
