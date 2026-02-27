# PROMPT-CURRENT
**Task:** Fix BL-parser shipment ID counter — `create-from-bl` endpoint
**File:** `af-server/routers/shipments.py`
**Priority:** CRITICAL — data integrity

---

## Problem

The `create_from_bl` endpoint generates shipment IDs using its own isolated counter:

```python
counter_key = client.key("Counter", "shipment_v2")
counter_entity = client.get(counter_key)
if counter_entity:
    next_id = max(current_val, _V2_COUNTER_START - 1) + 1
    ...
else:
    counter_entity = client.entity(counter_key)
    next_id = _V2_COUNTER_START   # 10000
    counter_entity["value"] = next_id
client.put(counter_entity)
shipment_id = f"AF-{next_id:06d}"
```

This counter does NOT exist in Datastore, so on first call `counter_entity` is `None`, `next_id` is set to `10000`, and the shipment ID becomes `AF-010000`.

**But `AF-000001` was produced** — which means the Counter entity DID exist and had `value = 0`, causing `max(0, 9999) + 1 = 10000`... wait, actually the screenshot shows `AF-000001`. This means a different bug: the counter entity existed with `value = 0`, and `_V2_COUNTER_START` was overridden to 1, OR the counter was re-read as 0 and incremented to 1.

Regardless of the exact first-run behaviour — the fundamental issue is that this counter is **completely disconnected from the V1 AFCQ- sequence**. The correct ID after migrated records (max V1 is `AFCQ-003863`) should be `AF-003864` or higher.

---

## The Correct ID Generation Pattern

The existing `shipments-write.ts` (manual creation path) does this correctly:

1. Scan all `ShipmentOrderV2CountId` entities — find max V2 `countid`
2. Scan all `Quotation` keys-only — find max numeric suffix of `AFCQ-XXXXXX` keys
3. Global max + 1 = new countid
4. Write a `ShipmentOrderV2CountId` entity (keyed by the new shipment ID) to register it
5. Use `AF-{newCountid:06d}` as the shipment ID

The `create-from-bl` endpoint must use the same scan-based approach.

---

## Fix Required

In `af-server/routers/shipments.py`, inside the `create_from_bl` function, replace the entire counter block:

**REMOVE this block** (lines from `# Generate shipment ID` through `shipment_id = f"AF-{next_id:06d}"`):

```python
# Generate shipment ID
# Counter starts at 10000 to avoid collision with existing AFCQ-XXXXXX
# range (currently ~3900 records). AF- prefix is distinct from AFCQ-.
_V2_COUNTER_START = 10000
counter_key = client.key("Counter", "shipment_v2")
counter_entity = client.get(counter_key)
if counter_entity:
    current_val = counter_entity.get("value") or 0
    # Safety: if counter was accidentally initialized below safe start, reset it
    next_id = max(current_val, _V2_COUNTER_START - 1) + 1
    counter_entity["value"] = next_id
else:
    counter_entity = client.entity(counter_key)
    next_id = _V2_COUNTER_START
    counter_entity["value"] = next_id
client.put(counter_entity)

shipment_id = f"AF-{next_id:06d}"
```

**REPLACE with** this scan-based approach (matching `shipments-write.ts`):

```python
# Generate shipment ID — scan-based global max (same logic as shipments-write.ts)
# Scans ShipmentOrderV2CountId for V2 max and Quotation keys for V1 AFCQ- max.
# Ensures the AF- sequence never collides with AFCQ- or previously issued AF- IDs.

# 1. Max V2 countid from ShipmentOrderV2CountId
v2_query = client.query(kind="ShipmentOrderV2CountId")
v2_entities = list(v2_query.fetch())
v2_max = 0
for e in v2_entities:
    val = e.get("countid") or 0
    if isinstance(val, (int, float)) and int(val) > v2_max:
        v2_max = int(val)

# 2. Max V1 countid from AFCQ- Quotation keys
v1_query = client.query(kind="Quotation")
v1_query.keys_only()
v1_entities = list(v1_query.fetch())
v1_max = 0
for e in v1_entities:
    key_name = e.key.name or ""
    if key_name.startswith("AFCQ-"):
        try:
            num = int(key_name[5:])
            if num > v1_max:
                v1_max = num
        except ValueError:
            pass

# 3. Also scan AF- and AF2- keys to catch any previously issued V2 IDs
for e in v1_entities:
    key_name = e.key.name or ""
    for prefix in ("AF-", "AF2-"):
        if key_name.startswith(prefix):
            try:
                num = int(key_name[len(prefix):])
                if num > v2_max:
                    v2_max = num
            except ValueError:
                pass

new_countid = max(v2_max, v1_max) + 1
shipment_id = f"AF-{new_countid:06d}"

# Register in ShipmentOrderV2CountId (matches the atomic write pattern in shipments-write.ts)
counter_key = client.key("ShipmentOrderV2CountId", shipment_id)
counter_entity = client.entity(counter_key)
counter_entity["countid"] = new_countid
counter_entity["created"] = now
client.put(counter_entity)
```

Also update the `countid` field written into the Quotation entity to use `new_countid` instead of `next_id`:

In the `q_entity.update({...})` block, change:
```python
"countid": next_id,
```
to:
```python
"countid": new_countid,
```

---

## After the Fix

The next BL-created shipment ID will be `AF-003865` (or higher if any `AF-` IDs were already issued and registered in `ShipmentOrderV2CountId`).

**Also required: delete the rogue `AF-000001` record** that was created by the broken counter. Do this via the delete endpoint or directly in Datastore — do NOT do it in this code change.

---

## Notes

- Do NOT touch the `ShipmentWorkFlow` write block — that is correct
- Do NOT touch the `parse-bl` endpoint — that is a separate read-only operation
- The `Counter` Kind entity (`"shipment_v2"`) can be ignored — it will simply stop being used
- The scan runs once per creation call — acceptable at current scale (~2,034 records)
