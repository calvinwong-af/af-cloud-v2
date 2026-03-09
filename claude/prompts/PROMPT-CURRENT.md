# Prompt v5.78 — Port Transport: terminal_id support + area seed data + migration script fixes

## Context

The port transport pricing module was built in v5.76/v5.77. Before running the live data migration from Datastore, three issues need to be resolved:

1. **Schema gap:** `port_transport_rate_cards` has no `terminal_id` column. MYPKG has two terminals — Northport (`MYPKG_N`) and Westport (`MYPKG_W`). The legacy Datastore used `MYPKG_N` as a port_un_code to represent Northport cards. In the new system, both terminals use `port_un_code = MYPKG`, distinguished by `terminal_id`. The `port_terminals` table already has `terminal_id = 'MYPKG_N'` (Northport) and `terminal_id = 'MYPKG_W'` (Westport).

2. **Missing area seed data:** Area codes `MY-KUL-000` and `MY-MLK-000` do not exist in the `areas` table but exist in Datastore legacy data. These are catch-all general delivery zones for KL and Melaka.

3. **Migration script gaps:** The script needs to map legacy `port_un_code = 'MYPKG_N'` → `port_un_code = 'MYPKG'` + `terminal_id = 'MYPKG_N'`, and include `terminal_id` in the rate card insert and the `rate_card_key` format.

---

## Task A — Update migration 026 (schema change)

File: `af-server/migrations/026_transport_pricing.sql`

The tables were created locally from the previous 026 run (empty tables exist). Drop and recreate them with the updated schema.

**Changes to `port_transport_rate_cards`:**
- Add `terminal_id VARCHAR(20) NULL REFERENCES port_terminals(terminal_id)` column after `port_un_code`
- Update `rate_card_key` comment: now format `MYPKG:MYPKG_N:12:lorry_3t` (terminal included when present, else `MYPKG:12:lorry_3t`)
- Update the `UNIQUE (port_un_code, area_id, vehicle_type_id)` constraint to `UNIQUE (port_un_code, terminal_id, area_id, vehicle_type_id)` — NULL terminal is a valid distinct value in Postgres UNIQUE constraints (NULLs are treated as distinct), so Westport cards with `terminal_id = NULL` and Northport cards with `terminal_id = 'MYPKG_N'` for the same area/vehicle will not conflict
- Add index: `CREATE INDEX IF NOT EXISTS idx_port_transport_rate_cards_terminal ON port_transport_rate_cards(terminal_id) WHERE terminal_id IS NOT NULL;`

The DROP + CREATE sequence to put in the migration file (replace existing content):
```sql
DROP TABLE IF EXISTS port_transport_rates CASCADE;
DROP TABLE IF EXISTS port_transport_rate_cards CASCADE;
-- then the updated CREATE TABLE statements
```

Note: `port_transport_rates` has no schema changes — only `port_transport_rate_cards` changes.

---

## Task B — Seed missing areas

File: `af-server/migrations/026_transport_pricing.sql`

Append seed inserts at the bottom of the migration file for the two missing catch-all areas:

```sql
-- Seed: catch-all delivery areas missing from initial haulage_areas migration
INSERT INTO areas (area_code, area_name, port_un_code, state_code, is_active)
VALUES
    ('MY-KUL-000', 'Kuala Lumpur (General)', 'MYPKG', 'MY-KUL', true),
    ('MY-MLK-000', 'Melaka (General)',        'MYPKG', 'MY-MLK', true)
ON CONFLICT (area_code, port_un_code) DO NOTHING;
```

---

## Task C — Update backend router

File: `af-server/routers/pricing/port_transport.py`

### C1 — Pydantic model: add terminal_id to PortTransportRateCardCreate
```python
class PortTransportRateCardCreate(BaseModel):
    port_un_code: str
    terminal_id: Optional[str] = None   # ADD THIS
    area_id: int
    vehicle_type_id: str
    include_depot_gate_fee: bool = False
```

### C2 — _row_to_rate_card helper: add terminal_id field
The SELECT for rate cards needs to include `terminal_id`. Update `_row_to_rate_card` to map the new column. Find the existing rate card SELECT queries in the router and add `terminal_id` to them.

The current `_row_to_rate_card` maps 9 positional columns (id, rate_card_key, port_un_code, area_id, vehicle_type_id, include_depot_gate_fee, is_active, created_at, updated_at). Add `terminal_id` as r[9] (insert after port_un_code at r[2], shifting others — or add at end of SELECT and as r[9]).

Recommended approach: add `terminal_id` as the last selected column in all rate card SELECT statements, and add it as `r[9]` in `_row_to_rate_card`:
```python
def _row_to_rate_card(r) -> dict:
    return {
        "id": r[0],
        "rate_card_key": r[1],
        "port_un_code": r[2],
        "terminal_id": r[9],        # ADD
        "area_id": r[3],
        "vehicle_type_id": r[4],
        "include_depot_gate_fee": r[5],
        "is_active": r[6],
        "created_at": str(r[7]) if r[7] else None,
        "updated_at": str(r[8]) if r[8] else None,
    }
```

Add `terminal_id` to all SELECT queries that feed `_row_to_rate_card`. There are at least 3 places: the list endpoint, the get-by-id endpoint, and the create endpoint RETURNING clause.

### C3 — Rate card create endpoint: include terminal_id in INSERT
```python
rate_card_key = (
    f"{body.port_un_code}:{body.terminal_id}:{body.area_id}:{body.vehicle_type_id}"
    if body.terminal_id
    else f"{body.port_un_code}:{body.area_id}:{body.vehicle_type_id}"
)
```

Add `terminal_id` to the INSERT statement and parameters.

### C4 — List rate cards endpoint: add terminal_id filter param
Add optional `terminal_id` query param to `list_transport_rate_cards`. When provided, filter `WHERE rc.terminal_id = :terminal_id`. When not provided, no filter (returns all terminals).

---

## Task D — Update migration script

File: `af-server/scripts/migrate_transport_pricing.py`

### D1 — Port code normalisation + terminal_id resolution

In `migrate_rate_cards`, after extracting `port_un_code` from the Datastore entity, apply this mapping before any further processing:

```python
# Normalise legacy port codes and resolve terminal_id
# MYPKG_N was used in legacy system to represent Northport terminal at Klang
LEGACY_PORT_TERMINAL_MAP = {
    "MYPKG_N": ("MYPKG", "MYPKG_N"),  # Northport
}

terminal_id = None
if port_un_code in LEGACY_PORT_TERMINAL_MAP:
    port_un_code, terminal_id = LEGACY_PORT_TERMINAL_MAP[port_un_code]
```

Add `LEGACY_PORT_TERMINAL_MAP` as a module-level constant.

### D2 — rate_card_key format update
```python
rate_card_key = (
    f"{port_un_code}:{terminal_id}:{area_id}:{vehicle_type_id}"
    if terminal_id
    else f"{port_un_code}:{area_id}:{vehicle_type_id}"
)
```

### D3 — INSERT statement update
Add `terminal_id` to the INSERT into `port_transport_rate_cards`:
```sql
INSERT INTO port_transport_rate_cards
    (rate_card_key, port_un_code, terminal_id, area_id, vehicle_type_id,
     include_depot_gate_fee, is_active)
VALUES
    (:key, :port, :terminal_id, :area_id, :vehicle_type_id, :dgf, :active)
ON CONFLICT (rate_card_key) DO NOTHING
RETURNING id
```

Add `"terminal_id": terminal_id` to the params dict.

### D4 — ON CONFLICT fallback SELECT update
The fallback `SELECT id FROM port_transport_rate_cards WHERE rate_card_key = :key` is already keyed on `rate_card_key` which now includes terminal — no change needed there.

### D5 — Dry run reporting: fix 0 rates bug
The dry run shows 0 rates because `card_map[pt_id] = -1` causes all rates to be skipped via `if db_card_id == -1: continue`. Fix this so dry run properly counts rates:

```python
# In migrate_rates, change the dry-run skip check:
if db_card_id == -1:
    # dry run — still count for reporting, use pt_id as placeholder key
    db_card_id = pt_id  # use pt_id as surrogate key for grouping
```

And move the dry-run total count to after grouping completes (it already is — just remove the `continue`).

### D6 — Update docstring
Update the field mapping comment at the top of the file to document `terminal_id` and `MYPKG_N` normalisation.

---

## Task E — Update frontend types

File: `af-platform/src/app/actions/pricing.ts`

Add `terminal_id: string | null` to the `PortTransportRateCard` interface (or wherever that type is defined in the pricing actions file).

---

## Verification steps (after implementation)

1. Run migration 026 locally to drop/recreate tables with new schema:
   ```
   -- Run 026_transport_pricing.sql against local DB
   ```
2. Dry run migration script — should now show non-zero rates count and MYPKG_N cards showing as `MYPKG:MYPKG_N:area_id:vehicle_type_id`:
   ```
   .venv\Scripts\python scripts\migrate_transport_pricing.py --dry-run
   ```
3. Confirm `GET /api/v2/pricing/port-transport/areas` still returns OK
4. Confirm `GET /api/v2/pricing/port-transport/vehicle-types` still returns OK

---

## Files to modify
- `af-server/migrations/026_transport_pricing.sql`
- `af-server/routers/pricing/port_transport.py`
- `af-server/scripts/migrate_transport_pricing.py`
- `af-platform/src/app/actions/pricing.ts`

