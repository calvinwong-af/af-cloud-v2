# Prompt v5.62b — Recover migrate_customs_charges.py (file was corrupted)

## Context

`af-server/scripts/migrate_customs_charges.py` was accidentally truncated to only its header block (~30 lines, 1004 bytes). It needs to be fully regenerated.

The script was originally created in prompt v5.61. The reference implementation is `af-server/scripts/migrate_local_charges.py` — read it fully before writing.

`DRY_RUN` must be set to `False` in the regenerated file (live run is ready to execute).

---

## Task — Regenerate migrate_customs_charges.py

Read `af-server/scripts/migrate_local_charges.py` fully, then rewrite `af-server/scripts/migrate_customs_charges.py` following the same structure with these differences:

| | Local Charges | Customs |
|---|---|---|
| Datastore kind (items) | `PricingLocalCharges` | `PricingCustomsCharges` |
| Datastore kind (rates filter) | `kind=PT-LOCAL-CHARGES` | `kind=PT-CUSTOMS-CHARGES` |
| Target table | `local_charges` | `customs_rates` |
| Container fields | `container_size`, `container_type` | None — no container dimension |
| Valid UOMs | Full set incl. QTL, RAIL_3KG | `{'CONTAINER', 'CBM', 'KG', 'W/M', 'CW_KG', 'SET', 'BL'}` |
| UOM remaps | CTR→CONTAINER, RT→W/M, CW→CW_KG, C3KG→RAIL_3KG | CTR→CONTAINER, RT→W/M, CW→CW_KG (no C3KG) |
| `paid_with_freight` | Yes (from `conditions` dict) | No — not applicable |
| `is_domestic` | Yes | Yes — same logic |
| ON CONFLICT constraint | `lc_unique` | `customs_rates_unique` |

### customs_rates target columns:
```
port_code, trade_direction, shipment_type,
charge_code, description, price, cost, currency, uom,
is_domestic, effective_from, effective_to, is_active,
created_at, updated_at
```

### PricingCustomsCharges entity fields:
- `pt_id` — string key linking to rate entries
- `port_un_code` — port code (apply PORT_CODE_REMAP: MYPKG_N → MYPKG)
- `transaction_type` — maps to `trade_direction` (IMPORT/EXPORT)
- `container_load` — maps to `shipment_type` via `wildcard_to_all` (FCL/LCL/AIR/CB/ALL)
- `code` — maps to `charge_code`
- `description` — maps to `description`
- `is_domestic` — bool
- `trash` — inverted to `is_active`
- No `container_size` or `container_type` fields

### PTMonthlyRatePortCharges rate entry fields (same as local charges):
- `pt_id`, `month_year`, `uom`, `price`, `cost`, `currency`
- No `conditions` field

### Script configuration block:
```python
DRY_RUN = False  # Set to False to execute real inserts
```

### Dry-run summary confirmed (for reference):
- PricingCustomsCharges entities: 304
- PTMonthlyRatePortCharges entries: 18,056
- Port remaps: 17
- UOM remaps: 3,025
- Rows would insert: 18,056
- Zero skips on all validation categories

---

## Verification

1. Run with `DRY_RUN = False`:
   ```
   cd C:\dev\af-cloud-v2
   af-server\.venv\Scripts\python.exe af-server/scripts/migrate_customs_charges.py
   ```
2. Expected: `Rows inserted: 18,056`
3. File size should be comparable to `migrate_local_charges.py` (~16KB)
