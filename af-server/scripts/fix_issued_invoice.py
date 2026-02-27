"""
scripts/fix_issued_invoice.py

One-time fix: mark 5 known-invoiced orders as issued_invoice=True
on both Quotation and ShipmentOrder records.

Dry run (default):
  python scripts/fix_issued_invoice.py

Live run:
  DRY_RUN=false python scripts/fix_issued_invoice.py
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google.cloud import datastore
from core.constants import PROJECT_ID

DRY_RUN = os.environ.get("DRY_RUN", "true").lower() != "false"

# Orders confirmed as already invoiced
FIX_IDS = [
    "AFCQ-000378",
    "AFCQ-000379",
    "AFCQ-000449",
    "AFCQ-000749",
    "AFCQ-003853",
]


def main():
    mode = "DRY RUN" if DRY_RUN else "LIVE"
    print(f"=== Fix issued_invoice — {mode} ===\n")

    client = datastore.Client(project=PROJECT_ID)

    for sid in FIX_IDS:
        entities_to_put = []

        # Quotation record
        q_key = client.key("Quotation", sid)
        q_entity = client.get(q_key)
        if q_entity:
            current = q_entity.get("issued_invoice")
            print(f"  {sid} Quotation.issued_invoice = {current!r} -> True")
            q_entity["issued_invoice"] = True
            entities_to_put.append(q_entity)
        else:
            print(f"  {sid} Quotation NOT FOUND")

        # ShipmentOrder record (migrated)
        so_key = client.key("ShipmentOrder", sid)
        so_entity = client.get(so_key)
        if so_entity:
            current = so_entity.get("issued_invoice")
            print(f"  {sid} ShipmentOrder.issued_invoice = {current!r} -> True")
            so_entity["issued_invoice"] = True
            entities_to_put.append(so_entity)
        else:
            print(f"  {sid} ShipmentOrder NOT FOUND")

        if not DRY_RUN and entities_to_put:
            client.put_multi(entities_to_put)
            print(f"  {sid} WRITTEN")
        print()

    print("Done.")


if __name__ == "__main__":
    main()
