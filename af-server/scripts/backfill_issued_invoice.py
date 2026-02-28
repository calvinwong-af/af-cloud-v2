"""
scripts/backfill_issued_invoice.py

Backfill issued_invoice on V1 ShipmentOrder and Quotation records.

Reads from both Kinds, resolves the correct value (OR logic — either True = True),
and writes back to both so stats queries have a reliable field.

Usage:
    python -m scripts.backfill_issued_invoice           # dry run (default safe)
    python -m scripts.backfill_issued_invoice --commit  # write changes
"""

import argparse
import os
import sys

from google.cloud.datastore.query import PropertyFilter

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.datastore import get_client, get_multi_chunked
from core.constants import V1_STATUS_COMPLETED, PREFIX_V1_SHIPMENT


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true", help="Write changes (default: dry run)")
    args = parser.parse_args()
    dry_run = not args.commit

    print(f"Mode: {'DRY RUN' if dry_run else 'COMMIT'}")
    print("Fetching V1 completed ShipmentOrder records...")

    client = get_client()

    # Fetch all V1 completed ShipmentOrders
    # Status 10000 = V1_STATUS_COMPLETED
    # Also include records where V2 codes may have been written (5001)
    so_query = client.query(kind="ShipmentOrder")
    # Broad fetch — we filter in-memory for completed only
    # (cannot use tight filter due to mixed V1/V2 codes on some records)
    so_query.add_filter(filter=PropertyFilter("status", ">=", V1_STATUS_COMPLETED))

    all_so = list(so_query.fetch())
    print(f"Fetched {len(all_so)} ShipmentOrder records with status >= {V1_STATUS_COMPLETED}")

    # Filter: only V1 records (no data_version=2), only AFCQ- prefix
    v1_completed = []
    for e in all_so:
        sid = e.key.name or str(e.key.id)
        if not sid.startswith(PREFIX_V1_SHIPMENT):
            continue
        if e.get("data_version") == 2:
            continue
        # Accept native V1 completed (10000) or V2 code written on V1 record (5001)
        status = e.get("status", 0)
        if status not in (V1_STATUS_COMPLETED, 5001):
            continue
        v1_completed.append(e)

    print(f"V1 completed records to process: {len(v1_completed)}")

    # Batch-fetch corresponding Quotation records
    sids = [e.key.name or str(e.key.id) for e in v1_completed]
    q_keys = [client.key("Quotation", sid) for sid in sids]
    q_entities = get_multi_chunked(client, q_keys)
    q_map = {(e.key.name or str(e.key.id)): e for e in q_entities}

    # Counters
    count_invoiced_so = 0
    count_invoiced_q_only = 0
    count_not_invoiced = 0
    count_skipped_no_q = 0
    count_to_write = 0

    so_to_put = []
    q_to_put = []

    for so_entity in v1_completed:
        sid = so_entity.key.name or str(so_entity.key.id)
        q_entity = q_map.get(sid)

        issued_so = bool(so_entity.get("issued_invoice", False))
        issued_q = bool(q_entity.get("issued_invoice", False)) if q_entity else False

        # OR logic: if either says invoiced, it's invoiced
        final_value = issued_so or issued_q

        if issued_so:
            count_invoiced_so += 1
        elif issued_q:
            count_invoiced_q_only += 1
        elif q_entity is None:
            count_skipped_no_q += 1
        else:
            count_not_invoiced += 1

        # Check if write is needed
        so_needs_write = so_entity.get("issued_invoice") != final_value
        q_needs_write = q_entity is not None and q_entity.get("issued_invoice") != final_value

        if so_needs_write or q_needs_write:
            count_to_write += 1
            if not dry_run:
                if so_needs_write:
                    so_entity["issued_invoice"] = final_value
                    so_to_put.append(so_entity)
                if q_needs_write and q_entity:
                    q_entity["issued_invoice"] = final_value
                    q_to_put.append(q_entity)
            else:
                print(f"  [DRY RUN] {sid}: SO={issued_so} Q={issued_q} -> final={final_value}")

    # Batch write in chunks of 500
    if not dry_run:
        CHUNK = 500
        print(f"Writing {len(so_to_put)} ShipmentOrder records...")
        for i in range(0, len(so_to_put), CHUNK):
            client.put_multi(so_to_put[i:i+CHUNK])

        print(f"Writing {len(q_to_put)} Quotation records...")
        for i in range(0, len(q_to_put), CHUNK):
            client.put_multi(q_to_put[i:i+CHUNK])

    # Summary
    print("\n=== SUMMARY ===")
    print(f"Total V1 completed scanned:     {len(v1_completed)}")
    print(f"Invoiced (on ShipmentOrder):    {count_invoiced_so}")
    print(f"Invoiced (Quotation only):      {count_invoiced_q_only}")
    print(f"Not invoiced:                   {count_not_invoiced}")
    print(f"Skipped (no Quotation):         {count_skipped_no_q}")
    print(f"Records {'would write' if dry_run else 'written'}:  {count_to_write}")


if __name__ == "__main__":
    main()
