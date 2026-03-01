# PROMPT — Shipment List: Missing V2 Orders + AFCQ Dedup + V1 Badge
**Version:** v2.34
**Date:** 2026-03-01
**Target:** VS Code / Opus 4.6

---

## Context

The shipment list page (`/shipments`) is not showing all orders correctly.
Three related problems have been identified from a visual test of the Active tab.

---

## Problem 1 — Native V2 AF- records missing from the list

Records like AF-003864, AF-003863, AF-003861 are native V2 Quotation records
(data_version=2, no migrated_from_v1). They are Active, not trashed, and
should appear on the Active tab — but they are missing.

**Suspected root cause: `trash` filter mismatch in Datastore.**

The V2 Quotation query in `list_shipments()` filters:
```python
v2_query.add_filter(filter=PropertyFilter("trash", "=", False))
```

In Google Cloud Datastore, a missing property does NOT match `= False`.
If these native V2 records were created without `trash` explicitly set to
`False` (or have `trash=None`), they are silently excluded by this filter.

**Fix:**
1. In `list_shipments()` in `af-server/routers/shipments.py`, after fetching
   the V2 Quotation query results, do NOT filter by `trash` at the Datastore
   level. Instead, apply the trash filter in-memory:

   ```python
   # BEFORE
   v2_query.add_filter(filter=PropertyFilter("trash", "=", False))

   # AFTER — remove the Datastore-level trash filter entirely for V2 Quotation
   # and apply in-memory instead:
   for entity in v2_query.fetch():
       if entity.get("trash") is True:   # only exclude explicitly trashed
           continue
       ...
   ```

   This ensures records with `trash=None` or missing `trash` are NOT excluded.

2. Apply the same fix to the **migrated ShipmentOrder query** in
   `list_shipments()` (the second `if not cursor:` block querying
   `ShipmentOrder` with `data_version=2`).

3. Apply the same fix to the **V2 stats query** in `get_shipment_stats()`
   (the Quotation Kind query with `data_version=2`).

4. Apply the same fix to the **migrated stats query** in
   `get_shipment_stats()` (the ShipmentOrder Kind query with `data_version=2`).

**Important:** Do NOT change the trash handling for the V1 ShipmentOrder
query — V1 records do not have a trash field and that path does not filter
by trash at all.

---

## Problem 2 — AFCQ-003862 still appearing in the list

AFCQ-003862 was migrated to AF-003862. The original ShipmentOrder entity
(key=AFCQ-003862) should have `superseded=True` set by the migration script.
The list endpoint skips records where `so_entity.get("superseded") is True`.

**Investigation step:** Check whether AFCQ-003862's ShipmentOrder entity
actually has `superseded=True` set in Datastore.

If `superseded` is NOT set on this record, the migration script missed it.
The fix in that case is a one-time Datastore write to set
`superseded=True` on the ShipmentOrder entity with key `AFCQ-003862`.

**Write a script** at `af-server/scripts/fix_afcq_003862_superseded.py`:
```python
"""
One-time fix: set superseded=True on ShipmentOrder AFCQ-003862
so it no longer appears in the list alongside its migrated AF-003862 counterpart.
Run with: python -m scripts.fix_afcq_003862_superseded
"""
from core.datastore import get_client

def main():
    client = get_client()
    key = client.key("ShipmentOrder", "AFCQ-003862")
    entity = client.get(key)
    if not entity:
        print("AFCQ-003862 ShipmentOrder not found")
        return
    if entity.get("superseded"):
        print("Already superseded — nothing to do")
        return
    entity["superseded"] = True
    client.put(entity)
    print("Done — AFCQ-003862 marked as superseded")

if __name__ == "__main__":
    main()
```

Then run it once. After this, AFCQ-003862 will be excluded from the list
and only AF-003862 (the migrated AF- record) will appear.

---

## Problem 3 — V1 badge not showing on migrated AF- records

The badge condition in `ShipmentRow` and `ShipmentCard` (added in v2.33)
is already correct:
```tsx
{(order.data_version === 1 || order.migrated_from_v1 === true || order.quotation_id?.startsWith('AFCQ-')) && ...}
```

The server's `_make_migrated_summary()` already sets `migrated_from_v1: True`.
`ShipmentListItem` in `actions/shipments.ts` has `migrated_from_v1?: boolean`.
`toShipmentOrder()` in `shipments/page.tsx` maps `migrated_from_v1: item.migrated_from_v1`.

**The badge problem is a consequence of Problem 1.** Once the missing AF-
records are restored to the list (Problem 1 fix), verify:
- Migrated AF- records (those returned by `_make_migrated_summary()`) show the V1 badge
- Native V2 AF- records (returned by `_make_v2_summary()`) do NOT show the badge

If migrated records still don't show the badge after the Problem 1 fix,
check that the `migrated_from_v1` field is being serialised correctly
through the JSON response. Add a console.log in `toShipmentOrder()` to
verify the field is present on migrated items.

---

## Files to Modify

| File | Change |
|---|---|
| `af-server/routers/shipments.py` | Remove Datastore-level `trash=False` filters from V2/migrated queries in both `list_shipments()` and `get_shipment_stats()`. Replace with in-memory `if entity.get("trash") is True: continue` |
| `af-server/scripts/fix_afcq_003862_superseded.py` | New one-time script — write and run |

---

## Expected Outcome

1. All active AF- records (native V2 and migrated) appear in the Active tab
2. AFCQ-003862 no longer appears; only AF-003862 (its migrated equivalent) shows
3. Migrated AF- records (migrated_from_v1=True) show the V1 badge
4. Native V2 AF- records (e.g. AF-003867) do NOT show the V1 badge
5. Stats counts remain unchanged (Active=22, To Invoice=8, etc.)
