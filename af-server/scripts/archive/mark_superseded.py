"""
scripts/mark_superseded.py

One-time script: stamps superseded=True on AFCQ- ShipmentOrder records
that have a corresponding AF- Quotation with migrated_from_v1=True.

After running, the list/stats V1 loops can use a fast persistent skip.

Usage:
    .venv\\Scripts\\python scripts/mark_superseded.py            # dry run
    .venv\\Scripts\\python scripts/mark_superseded.py --commit    # write changes
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google.cloud import datastore
from google.cloud.datastore.query import PropertyFilter

from core.constants import PREFIX_V1_SHIPMENT, PREFIX_V2_SHIPMENT, PROJECT_ID
from core.datastore import get_multi_chunked


def main():
    parser = argparse.ArgumentParser(description="Mark superseded AFCQ- ShipmentOrder records")
    parser.add_argument("--commit", action="store_true", help="Write changes (default: dry run)")
    args = parser.parse_args()

    dry_run = not args.commit
    mode = "DRY RUN" if dry_run else "LIVE"
    print(f"=== Mark Superseded — {mode} ===\n")

    client = datastore.Client(project=PROJECT_ID)

    # Fetch all AFCQ- ShipmentOrder records (no data_version=2)
    print("Fetching AFCQ- ShipmentOrder records...")
    so_query = client.query(kind="ShipmentOrder")
    all_so = list(so_query.fetch())

    afcq_records = []
    for e in all_so:
        key_name = e.key.name or str(e.key.id)
        if not key_name.startswith(PREFIX_V1_SHIPMENT):
            continue
        if e.get("data_version") == 2:
            continue
        afcq_records.append(e)

    print(f"  Found {len(afcq_records)} AFCQ- ShipmentOrder records")

    # Build AF- keys to check
    af_keys = []
    afcq_to_af = {}
    for e in afcq_records:
        afcq_id = e.key.name or str(e.key.id)
        af_id = f"AF-{afcq_id[5:]}"
        af_keys.append(client.key("Quotation", af_id))
        afcq_to_af[afcq_id] = af_id

    # Batch-fetch AF- Quotation records
    print("  Batch-fetching corresponding AF- Quotation records...")
    af_entities = get_multi_chunked(client, af_keys)
    af_migrated = set()
    for e in af_entities:
        if e.get("migrated_from_v1"):
            af_migrated.add(e.key.name or str(e.key.id))

    print(f"  Found {len(af_migrated)} migrated AF- records")

    # Mark superseded
    already_superseded = 0
    newly_marked = 0
    not_found = 0
    to_write = []

    for e in afcq_records:
        afcq_id = e.key.name or str(e.key.id)
        af_id = afcq_to_af[afcq_id]

        if e.get("superseded"):
            already_superseded += 1
            continue

        if af_id in af_migrated:
            newly_marked += 1
            if not dry_run:
                e["superseded"] = True
                e["superseded_by"] = af_id
                to_write.append(e)
        else:
            not_found += 1

    # Write
    if not dry_run and to_write:
        print(f"\nWriting {len(to_write)} records...")
        CHUNK = 500
        for i in range(0, len(to_write), CHUNK):
            chunk = to_write[i:i + CHUNK]
            client.put_multi(chunk)
            print(f"  Written {min(i + CHUNK, len(to_write))}/{len(to_write)}")

    # Summary
    print(f"\n=== Summary ===")
    print(f"Total AFCQ- checked:    {len(afcq_records)}")
    print(f"Already superseded:     {already_superseded}")
    print(f"Newly marked:           {newly_marked}")
    print(f"No AF- equivalent:      {not_found}")
    if dry_run:
        print(f"Records would write:    {newly_marked}")
    else:
        print(f"Records written:        {len(to_write)}")


if __name__ == "__main__":
    main()
