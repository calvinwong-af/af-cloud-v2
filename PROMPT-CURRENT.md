# Performance Fix: list_shipments endpoint — eliminate full table scans

## File
`af-server/routers/shipments.py`
Function: `list_shipments` (the `@router.get("")` endpoint)

## Problem
Every tab switch on the Shipments page takes 5+ seconds. Root cause is the
`list_shipments` endpoint doing full table scans on every request:

1. Full scan of ALL Quotation Kind entities (3,800+ records) — filtered in-memory
2. Full scan of ALL ShipmentOrder Kind entities (~2,030 records)
3. `get_multi_chunked` batch fetch of up to 2,030 Quotation records just for
   display fields (incoterm, order_type, cargo_ready_date)
4. `get_multi_chunked` batch fetch of all unique Company records for names

This results in 6,000+ Datastore reads per request.

## Fix

### 1. Eliminate the Quotation batch fetch for V1 list rows
The `_make_v1_summary` function fetches Quotation records just to get display
fields. But ShipmentOrder already stores the fields we need:
- `incoterm_code` (or `incoterm`)
- `quotation_type` (maps to order_type)
- `cargo_ready_date`
- `origin_port_un_code` / `destination_port_un_code`

Update `_make_v1_summary` to read these fields directly from `so_entity` and
remove the entire `q_keys` / `get_multi_chunked` / `q_map` block from
`list_shipments`. Only fall back to Quotation fetch if a critical field is
genuinely missing from ShipmentOrder (which should be rare).

### 2. Company name in-memory cache
Add a module-level dict `_company_name_cache: dict[str, str] = {}` with a
timestamp `_company_name_cache_ts: float = 0`.

In `_batch_company_names`, before hitting Datastore:
- If all requested company_ids are in the cache AND cache is < 5 minutes old,
  return from cache immediately
- Otherwise fetch missing IDs from Datastore, update cache, update timestamp

This means the ~628 company name lookups only hit Datastore once per 5 minutes
instead of on every request.

### 3. V2 query — keys_only projection for tab counting
The V2 query currently fetches full entities just to filter by status in-memory.
Add `.add_projection(["status", "issued_invoice", "company_id",
"origin_port_un_code", "destination_port_un_code", "incoterm_code",
"order_type", "transaction_type", "cargo_ready_date", "updated"])` to the V2
query so Datastore returns only the needed fields rather than full entity blobs.

Note: `excludeFromIndexes` fields cannot be projected — check that the above
fields are NOT in the `excludeFromIndexes` list in `shipments-write.ts`. If
they are excluded from indexes, skip the projection and fetch full entities.

### 4. Do NOT change pagination logic
The existing cursor-based pagination for V1 and the full-fetch for V2 (page 1
only) logic is correct — do not change it. Only optimise the data fetching
within each strategy.

## Expected outcome
- Tab switches should drop from 5+ seconds to under 1 second in production
- Local dev (hitting Tokyo Datastore from local machine) should drop to 1-3s
- The `to_invoice` tab (which intentionally fetches all completed records) will
  still be slower than other tabs — this is acceptable and expected

## Files to modify
- `af-server/routers/shipments.py` — `list_shipments`, `_make_v1_summary`,
  `_batch_company_names` functions only
- Do NOT modify stats, search, or any other endpoint
