# PROMPT v6.44 — Local Charges: DG Class Dimension — Router + API

## Context

This is Part B of the `dg_class_code` addition to `local_charges`.
Part A (v6.43) added the migration and updated the pricing engine resolver.
This prompt updates `af-server/routers/pricing/local_charges.py` so the API
can read, create, and update `dg_class_code` on local charge rows.

**Prerequisite:** Migration `049_local_charges_dg.sql` must already be applied to prod.

---

## File: `af-server/routers/pricing/local_charges.py`

### Change 1 — Add validation constant

After the existing `_VALID_UOMS` constant, add:

```python
_VALID_DG_CLASS_CODES = {"NON-DG", "DG-2", "DG-3", "ALL"}
```

### Change 2 — Update `LocalChargeCreate` model

Add `dg_class_code` field after `container_type`:

```python
    container_type: str = "ALL"
    dg_class_code: str = "NON-DG"
    charge_code: str
```

### Change 3 — Update `LocalChargeUpdate` model

Add `dg_class_code` field after `container_type`:

```python
    container_type: Optional[str] = None
    dg_class_code: Optional[str] = None
    charge_code: Optional[str] = None
```

### Change 4 — Update `_row_to_dict`

The current SELECT returns 19 columns (indices 0–18). `dg_class_code` will be added
to `_SELECT` as index 19. Update `_row_to_dict` to include it:

After `"is_active": r[16],` add:

```python
        "dg_class_code": r[19],
```

(Keep `created_at` as r[17] and `updated_at` as r[18] — they shift to r[20] and r[21]
after `dg_class_code` is inserted. Update those indices accordingly.)

### Change 5 — Update `_SELECT`

Find:

```python
_SELECT = """
    SELECT id, port_code, trade_direction, shipment_type, container_size, container_type,
           charge_code, description, price, cost, currency, uom,
           is_domestic, paid_with_freight,
           effective_from, effective_to, is_active, created_at, updated_at
    FROM local_charges
"""
```

Replace with:

```python
_SELECT = """
    SELECT id, port_code, trade_direction, shipment_type, container_size, container_type,
           charge_code, description, price, cost, currency, uom,
           is_domestic, paid_with_freight,
           effective_from, effective_to, is_active, created_at, updated_at,
           dg_class_code
    FROM local_charges
"""
```

And update `_row_to_dict` to match new indices:

```python
def _row_to_dict(r) -> dict:
    return {
        "id": r[0],
        "port_code": r[1],
        "trade_direction": r[2],
        "shipment_type": r[3],
        "container_size": r[4],
        "container_type": r[5],
        "charge_code": r[6],
        "description": r[7],
        "price": float(r[8]) if r[8] is not None else None,
        "cost": float(r[9]) if r[9] is not None else None,
        "currency": r[10],
        "uom": r[11],
        "is_domestic": r[12],
        "paid_with_freight": r[13],
        "effective_from": str(r[14]) if r[14] else None,
        "effective_to": str(r[15]) if r[15] else None,
        "is_active": r[16],
        "created_at": r[17].isoformat() if r[17] else None,
        "updated_at": r[18].isoformat() if r[18] else None,
        "dg_class_code": r[19],
    }
```

### Change 6 — Update `list_local_charge_cards` grouping key

Find the card_key construction:

```python
        card_key = f"{row['port_code']}|{row['trade_direction']}|{row['shipment_type']}|{row['container_size']}|{row['container_type']}|{row['charge_code']}|{str(row['is_domestic']).lower()}"
```

Replace with:

```python
        card_key = f"{row['port_code']}|{row['trade_direction']}|{row['shipment_type']}|{row['container_size']}|{row['container_type']}|{row['charge_code']}|{str(row['is_domestic']).lower()}|{row['dg_class_code']}"
```

Also expose `dg_class_code` in the card result dict. In the `result.append({...})` block,
add after `"paid_with_freight": latest["paid_with_freight"],`:

```python
            "dg_class_code": latest["dg_class_code"],
```

### Change 7 — Validate and insert `dg_class_code` in `create_local_charge`

After the `container_type` validation block, add:

```python
    if body.dg_class_code not in _VALID_DG_CLASS_CODES:
        raise HTTPException(status_code=400, detail=f"Invalid dg_class_code: {body.dg_class_code}")
```

Update the uniqueness check query to include `dg_class_code`:

```python
    existing = conn.execute(text("""
        SELECT id FROM local_charges
        WHERE port_code = :port AND trade_direction = :direction
          AND shipment_type = :stype AND container_size = :csize AND container_type = :ctype
          AND charge_code = :charge AND is_domestic = :domestic
          AND dg_class_code = :dg_class
          AND effective_from = :eff_from
    """), {
        ...existing params...,
        "dg_class": body.dg_class_code,
    }).fetchone()
```

Update the INSERT to include `dg_class_code` in both the column list and VALUES:

Add `dg_class_code` to the INSERT column list and `:dg_class` to VALUES,
and `"dg_class": body.dg_class_code` to the params dict.

Update the `close_previous` UPDATE WHERE clause to include `dg_class_code`:

```python
        conn.execute(text("""
            UPDATE local_charges
            SET effective_to = (CAST(:eff_from AS date) - INTERVAL '1 day')::date,
                updated_at = :now
            WHERE port_code = :port
              AND trade_direction = :direction
              AND shipment_type = :stype
              AND container_size = :csize
              AND container_type = :ctype
              AND charge_code = :charge
              AND is_domestic = :domestic
              AND dg_class_code = :dg_class
              AND effective_to IS NULL
              AND id != :new_id
        """), {
            ...existing params...,
            "dg_class": body.dg_class_code,
        })
```

### Change 8 — Handle `dg_class_code` in `update_local_charge`

Add `"dg_class_code": "dg_class_code"` to `field_map`.

Add validation inside the field loop:

```python
            if field == "dg_class_code" and val is not None and val not in _VALID_DG_CLASS_CODES:
                raise HTTPException(status_code=400, detail=f"Invalid dg_class_code: {val}")
```

---

## Verification

```bash
python -m py_compile af-server/routers/pricing/local_charges.py
```

Must pass clean. No migration needed (migration was in v6.43). No frontend changes.
