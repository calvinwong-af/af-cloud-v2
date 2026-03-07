# Prompt Completion Log — v5.11–v5.20

### [2026-03-07 UTC] — v5.11: Port Terminals Table + Pricing Terminal Awareness
- **Status:** Completed
- **Tasks:**
  - Created `migrations/014_port_terminals.sql` — port_terminals table, seed from ports.terminals JSONB, terminal_id FK on rate card tables
  - Created `scripts/run_migration_014.py` — migration runner with verification (row counts, column checks, terminal listing)
  - Added `GET /geography/port-terminals` and `GET /geography/port-terminals/{terminal_id}` endpoints with `_terminals_cache` (10-min TTL, invalidated with port cache)
  - Added `terminal_id` to FCL models (`FCLRateCardCreate`, `FCLRateCardUpdate`), `_RATE_CARD_SELECT`, `_row_to_rate_card`, create endpoint (with port validation), update endpoint
  - Added `terminal_id` to LCL models (`LCLRateCardCreate`, `LCLRateCardUpdate`), `_RATE_CARD_SELECT`, `_row_to_rate_card`, create endpoint (with port validation), update endpoint
  - Added `_PORT_TERMINAL_MAP`, `_get_terminal_id()` to `migrate_pricing_freight.py`, updated FCL/LCL INSERT statements to include `terminal_id`
- **Files Modified:**
  - `af-server/migrations/014_port_terminals.sql` (new)
  - `af-server/scripts/run_migration_014.py` (new)
  - `af-server/routers/geography.py`
  - `af-server/routers/pricing/fcl.py`
  - `af-server/routers/pricing/lcl.py`
  - `af-server/scripts/migrate_pricing_freight.py`

---
