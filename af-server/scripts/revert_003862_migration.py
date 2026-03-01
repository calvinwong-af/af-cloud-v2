"""
Revert migration: delete everything written by migrate_003862.py.

AFCQ-003862 is a cancelled order (superseded=True) that was incorrectly
migrated to AF-003862 during v2.41. This script removes all entities
created by that migration.

Usage:
    python -m scripts.revert_003862_migration            # dry-run (default)
    python -m scripts.revert_003862_migration --commit   # actually delete
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google.cloud import datastore
from google.cloud.datastore.query import PropertyFilter

from core.constants import PROJECT_ID
from core.datastore import entity_to_dict

AF_ID = "AF-003862"
AFCQ_ID = "AFCQ-003862"


def main():
    commit = "--commit" in sys.argv
    mode = "COMMIT" if commit else "DRY-RUN"
    print(f"=== Revert 003862 migration ({mode}) ===\n")

    client = datastore.Client(project=PROJECT_ID)

    # ------------------------------------------------------------------
    # Step 1: Check Quotation AF-003862
    # ------------------------------------------------------------------
    print(f"Step 1: Checking Quotation {AF_ID}...")
    q_entity = client.get(client.key("Quotation", AF_ID))
    if q_entity:
        q = entity_to_dict(q_entity)
        print(f"  Found: status={q.get('status')}, data_version={q.get('data_version')}, migrated_from_v1={q.get('migrated_from_v1')}")
    else:
        print(f"  Quotation {AF_ID} does not exist — nothing to revert.")
        print("  Checking remaining entities for completeness...\n")

    # ------------------------------------------------------------------
    # Step 2: Check ShipmentOrderV2CountId AF-003862
    # ------------------------------------------------------------------
    print(f"\nStep 2: Checking ShipmentOrderV2CountId {AF_ID}...")
    cid_entity = client.get(client.key("ShipmentOrderV2CountId", AF_ID))
    if cid_entity:
        cid = entity_to_dict(cid_entity)
        print(f"  Found: countid={cid.get('countid')}, migrated_from_v1={cid.get('migrated_from_v1')}")
    else:
        print(f"  Not found")

    # ------------------------------------------------------------------
    # Step 3: Check ShipmentWorkFlow AF-003862
    # ------------------------------------------------------------------
    print(f"\nStep 3: Checking ShipmentWorkFlow {AF_ID}...")
    wf_entity = client.get(client.key("ShipmentWorkFlow", AF_ID))
    if wf_entity:
        wf = entity_to_dict(wf_entity)
        print(f"  Found: shipment_id={wf.get('shipment_id')}")
    else:
        print(f"  Not found")

    # ------------------------------------------------------------------
    # Step 4: Check Files with shipment_order_id == AF-003862
    # ------------------------------------------------------------------
    print(f"\nStep 4: Checking Files with shipment_order_id={AF_ID}...")
    file_query = client.query(kind="Files")
    file_query.add_filter(filter=PropertyFilter("shipment_order_id", "=", AF_ID))
    file_entities = list(file_query.fetch())
    if file_entities:
        print(f"  Found {len(file_entities)} file(s) to re-key back to {AFCQ_ID}")
        for fe in file_entities:
            print(f"    - {fe.key.name or fe.key.id}")
    else:
        print(f"  No files found with shipment_order_id={AF_ID}")

    # ------------------------------------------------------------------
    # Step 5: Check ShipmentOrder AFCQ-003862 superseded flag
    # ------------------------------------------------------------------
    print(f"\nStep 5: Checking ShipmentOrder {AFCQ_ID} superseded flag...")
    so_entity = client.get(client.key("ShipmentOrder", AFCQ_ID))
    if so_entity:
        so = entity_to_dict(so_entity)
        superseded = so.get("superseded")
        print(f"  superseded={superseded}")
        if not superseded:
            print(f"  WARNING: superseded is not True — will restore it")
    else:
        print(f"  ShipmentOrder {AFCQ_ID} not found")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    to_delete = []
    if q_entity:
        to_delete.append(f"Quotation {AF_ID}")
    if cid_entity:
        to_delete.append(f"ShipmentOrderV2CountId {AF_ID}")
    if wf_entity:
        to_delete.append(f"ShipmentWorkFlow {AF_ID}")

    print(f"\n{'=' * 50}")
    print(f"Actions to perform:")
    for item in to_delete:
        print(f"  DELETE: {item}")
    if file_entities:
        print(f"  RE-KEY: {len(file_entities)} Files → shipment_order_id={AFCQ_ID}")
    if so_entity and not so_entity.get("superseded"):
        print(f"  RESTORE: ShipmentOrder {AFCQ_ID} superseded=True")
    if not to_delete and not file_entities:
        print("  Nothing to do — all clean.")
        return
    print(f"{'=' * 50}")

    if not commit:
        print(f"\nDry-run complete. Run with --commit to execute.")
        return

    # ------------------------------------------------------------------
    # Execute deletions
    # ------------------------------------------------------------------
    print(f"\nExecuting...")

    if q_entity:
        client.delete(client.key("Quotation", AF_ID))
        print(f"  DELETED: Quotation {AF_ID}")

    if cid_entity:
        client.delete(client.key("ShipmentOrderV2CountId", AF_ID))
        print(f"  DELETED: ShipmentOrderV2CountId {AF_ID}")

    if wf_entity:
        client.delete(client.key("ShipmentWorkFlow", AF_ID))
        print(f"  DELETED: ShipmentWorkFlow {AF_ID}")

    if file_entities:
        for fe in file_entities:
            fe["shipment_order_id"] = AFCQ_ID
        client.put_multi(file_entities)
        print(f"  RE-KEYED: {len(file_entities)} Files → shipment_order_id={AFCQ_ID}")

    if so_entity and not so_entity.get("superseded"):
        so_entity["superseded"] = True
        client.put(so_entity)
        print(f"  RESTORED: ShipmentOrder {AFCQ_ID} superseded=True")

    print(f"\n{'=' * 50}")
    print(f"Revert complete.")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    main()
