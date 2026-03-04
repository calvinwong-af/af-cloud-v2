"""
fix_v1_data_version.py

Fix: V1 ShipmentOrder records that have been incorrectly tagged with
data_version=2 by write endpoints (PATCH /bl, PATCH /parties, etc.).

A V1 ShipmentOrder is identified by:
  - Key name starts with "AFCQ-"
  - The corresponding Quotation has data_version=None or data_version=1

Setting data_version=2 on a V1 ShipmentOrder causes it to be routed
into the "migrated" code path, which expects V2 status codes. Since V1
status codes (e.g. 4110) are not V2 codes, the record is silently
dropped from all list/stats queries.

Fix: set data_version=None (delete the field) on affected ShipmentOrders.

Usage:
  cd af-server
  python scripts/fix_v1_data_version.py --dry-run   # preview
  python scripts/fix_v1_data_version.py              # live
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google.cloud import datastore
from google.cloud.datastore.query import PropertyFilter
from core.constants import PROJECT_ID

def main():
    dry_run = "--dry-run" in sys.argv
    mode = "DRY RUN" if dry_run else "LIVE"
    print(f"=== Fix V1 ShipmentOrder data_version contamination — {mode} ===\n")

    client = datastore.Client(project=PROJECT_ID)

    # Find all ShipmentOrder records with data_version=2
    query = client.query(kind="ShipmentOrder")
    query.add_filter(filter=PropertyFilter("data_version", "=", 2))
    all_dv2 = list(query.fetch())
    print(f"Total ShipmentOrder records with data_version=2: {len(all_dv2)}")

    to_fix = []
    for so_entity in all_dv2:
        key_name = so_entity.key.name or ""
        if not key_name.startswith("AFCQ-"):
            continue  # AF- prefix = genuine V2 migrated record, leave alone

        # Cross-check: does the Quotation also have data_version=2?
        q_entity = client.get(client.key("Quotation", key_name))
        q_dv = q_entity.get("data_version") if q_entity else None

        if q_dv == 2:
            # Both SO and Quotation say V2 — genuine migrated record, skip
            print(f"  SKIP {key_name}: Quotation also has data_version=2 (genuine migration)")
            continue

        so_status = so_entity.get("status")
        print(f"  FIX  {key_name}: ShipmentOrder.data_version=2 but Quotation.data_version={q_dv!r} "
              f"(status={so_status}) — contaminated by write endpoint")
        to_fix.append(so_entity)

    print(f"\n{len(to_fix)} records to fix.")

    if not to_fix:
        print("Nothing to do.")
        return

    if dry_run:
        print("\n[DRY RUN] No changes written.")
        return

    fixed = 0
    for so_entity in to_fix:
        # Remove data_version — V1 records should not have this field
        # Datastore: set to None to effectively clear it, or exclude from write
        # The safest approach is to set it explicitly to None which Datastore
        # stores as null, then the falsy check `entity.get("data_version") or 1`
        # in the read path will treat it as V1.
        so_entity["data_version"] = None
        client.put(so_entity)
        print(f"  Fixed: {so_entity.key.name}")
        fixed += 1

    print(f"\nDone. {fixed} ShipmentOrder records fixed.")

if __name__ == "__main__":
    main()
