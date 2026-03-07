# Session 44 Handover — AcceleFreight v2
**Date:** 2026-03-07
**Version:** v5.10 Live on Prod | v5.11 Prompt Ready
**Tests:** 272/286 (v2.61 — GT series retired)
**Session Type:** Deploy + pricing migration design

---

## Session Work

### Full Deploy — v5.07 through v5.10
- Code pushed to `main`, Cloud Build completed for both af-server + af-platform
- Migration 013 (`shipment_details.scope`) already on prod from Session 42 — verified
- Scope backfill run on prod: 32 updated, 1 already set, 33/33 eligible verified clean
- Prod smoke test: Configure Scope confirmed working on CNF IMPORT, EXW IMPORT, FOB EXPORT

### Pricing Migration — Pre-flight Analysis
Two issues identified and fixed before running pricing migration:

**Issue 1 — Backfill scripts targeting wrong table:**
`backfill_scope_from_tasks.py` and `verify_scope_backfill.py` were reading/writing `orders.scope` instead of `shipment_details.scope`. Fixed via MCP.

**Issue 2 — `MYPKG_N` legacy port code:**
Dry run revealed LCL rate cards using `MYPKG_N` as destination port — a legacy Datastore suffix for Port Klang North Port. This triggered a design discussion:
- Terminals are currently JSONB inside `ports` row (not first-class rows)
- Pricing tables have no FK to ports model — plain TEXT port codes
- `MYPKG_N` and `MYPKG_W` have different LCL rates (NP = cheaper, co-loaders operate there)
- WP rates exist but are rarer and typically higher

**Design decisions locked:**
1. Promote terminals to `port_terminals` table — first-class rows with FK from `ports`
2. Add nullable `terminal_id` to `fcl_rate_cards` and `lcl_rate_cards`
3. `MYPKG_N` in Datastore migrates as `port_code=MYPKG`, `terminal_id=MYPKG_N`
4. Quotation logic: fetch all rate cards for `port_code` regardless of terminal → cheapest cost wins → winning `terminal_id` informs shipment departure terminal
5. `ports.terminals` JSONB stays unchanged — no breaking change to existing port selector UI

### Diagnostic Script Written
`af-server/scripts/diagnose_pricing_warnings.py` — reports:
- Non-standard port codes in rate card definitions (underscores, length > 5)
- Missing currency by month_year breakdown
- Missing UOM by month_year breakdown

**Not yet run** — blocked pending migration 014 design.

### Migration Script — Partial Update
`migrate_pricing_freight.py` updated with:
- `_PORT_CODE_MAP: {"MYPKG_N": "MYPKG"}` — normalises port codes
- `_normalise_port_code()` helper
- Applied to both FCL and LCL rate card INSERT params

Terminal_id carry-through (`_PORT_TERMINAL_MAP`) deferred to v5.11 Opus execution.

---

## v5.11 Prompt — Ready for Opus

**File:** `claude/prompts/PROMPT-CURRENT.md`

**Deliverables:**
1. `af-server/migrations/014_port_terminals.sql` — new table + seed from JSONB + terminal_id columns on rate cards
2. `af-server/scripts/run_migration_014.py` — migration runner with verification
3. `af-server/routers/geography.py` — add `GET /port-terminals` + `GET /port-terminals/{terminal_id}` endpoints + cache
4. `af-server/routers/pricing/fcl.py` — add `terminal_id` to models, SELECT, INSERT, UPDATE
5. `af-server/routers/pricing/lcl.py` — same as FCL
6. `af-server/scripts/migrate_pricing_freight.py` — add `_PORT_TERMINAL_MAP`, `_get_terminal_id()`, carry terminal_id through FCL + LCL rate card INSERTs

**Key constraint:** `rate_card_key` (pt_id from Datastore e.g. `CNSHA:MYPKG_N:NON-DG`) is stored as-is — opaque dedup key. Only `origin_port_code`, `destination_port_code`, `terminal_id` get normalised treatment.

---

## Pending Work Queue

### Immediate (next session)
1. **Run Opus on v5.11** — migration 014 + terminal awareness
2. **Run `run_migration_014.py` locally** — verify port_terminals seeded, columns added
3. **Run `diagnose_pricing_warnings.py`** — audit non-standard port codes + currency breakdown by month
4. **Re-run `migrate_pricing_freight.py --dry-run`** — verify terminal_id is being set for MYPKG_N lanes
5. **Run full pricing migration** after dry run verified

### After pricing migration verified
6. `cleanup_pricing_duplicates.py --dry-run` then full run
7. af-platform pricing UI — prototype/mockup design session first

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

## Key Architecture — Terminal-Aware Pricing

### port_terminals table
```
terminal_id   TEXT PK          e.g. 'MYPKG_N', 'MYPKG_W'
port_un_code  TEXT FK→ports    e.g. 'MYPKG'
name          TEXT             e.g. 'Northport'
is_default    BOOLEAN          MYPKG_W = true, MYPKG_N = false
is_active     BOOLEAN
```

### Rate card terminal_id
- Nullable — NULL means no terminal distinction (most ports)
- MYPKG lanes: NP rates → `terminal_id = MYPKG_N`, WP rates → `terminal_id = MYPKG_W`

### Quotation query pattern (cheapest wins)
```sql
SELECT rc.terminal_id, r.cost, r.list_price, r.currency
FROM lcl_rate_cards rc
JOIN lcl_rates r ON r.rate_card_id = rc.id
WHERE rc.destination_port_code = :port_code   -- e.g. 'MYPKG'
  AND r.supplier_id = :supplier_id
  AND r.effective_from <= :ref_date
ORDER BY r.cost ASC NULLS LAST
LIMIT 1
-- terminal_id on result row informs shipment departure terminal
```

### Port code normalisation in migration
```python
_PORT_CODE_MAP = {"MYPKG_N": "MYPKG"}          # port_code stored
_PORT_TERMINAL_MAP = {"MYPKG_N": "MYPKG_N"}    # terminal_id stored
# rate_card_key = pt_id from Datastore (stored as-is, not normalised)
```

---

## File Locations
- Active prompt: `claude/prompts/PROMPT-CURRENT.md` (v5.11 — ready for Opus)
- Prompt log: `claude/prompts/log/PROMPT-LOG-v5.00-v5.10.md`
- Tests master: `claude/tests/AF-Test-Master.md` (v2.61 — 272/286)
- Deploy checklist: `claude/other/AF-Deploy-v5.07-v5.10.md` (complete)
- Diagnostic script: `af-server/scripts/diagnose_pricing_warnings.py` (not yet run)
- Migration (pending): `af-server/migrations/014_port_terminals.sql` (written by Opus)
- Pricing migration: `af-server/scripts/migrate_pricing_freight.py` (partial update — terminal carry-through pending v5.11)
