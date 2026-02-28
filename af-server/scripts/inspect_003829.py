"""
inspect_003829.py

Diagnostic: print key fields from AFCQ-003829 ShipmentOrder entity
to identify why it's missing from the active shipments list.

Usage:
  cd af-server
  python scripts/inspect_003829.py
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google.cloud import datastore
from google.cloud.datastore.query import PropertyFilter
from core.constants import PROJECT_ID

SHIPMENT_ID = "AFCQ-003829"

def main():
    client = datastore.Client(project=PROJECT_ID)

    print(f"=== ShipmentOrder: {SHIPMENT_ID} ===\n")
    key = client.key("ShipmentOrder", SHIPMENT_ID)
    entity = client.get(key)
    if not entity:
        print("ERROR: ShipmentOrder not found")
    else:
        for f in ["status", "company_id", "data_version", "trash", "updated"]:
            print(f"  {f}: {entity.get(f)!r}")

    print(f"\n=== Quotation: {SHIPMENT_ID} ===\n")
    q_entity = client.get(client.key("Quotation", SHIPMENT_ID))
    if not q_entity:
        print("ERROR: Quotation not found")
    else:
        for f in ["status", "company_id", "data_version", "has_shipment", "trash"]:
            print(f"  {f}: {q_entity.get(f)!r}")

    print("\n=== Query: ShipmentOrder company_id=AFC-0005, status 110-9999 ===\n")
    q = client.query(kind="ShipmentOrder")
    q.add_filter(filter=PropertyFilter("company_id", "=", "AFC-0005"))
    q.add_filter(filter=PropertyFilter("status", ">=", 110))
    q.add_filter(filter=PropertyFilter("status", "<", 10000))
    results = list(q.fetch())
    print(f"  {len(results)} records found:")
    for r in results:
        print(f"    {r.key.name}: status={r.get('status')}, company_id={r.get('company_id')!r}")

if __name__ == "__main__":
    main()
