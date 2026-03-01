"""
One-time fix: Set incoterm_code on Quotation AF-003862.

The migration script (migrate_003862.py) set incoterm_code to None because
neither Quotation AFCQ-003862 nor ShipmentOrder AFCQ-003862 contained
an incoterm field. This script checks all possible sources and patches
the record.

Run with: python -m scripts.fix_af_003862_incoterm
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google.cloud import datastore

from core.constants import PROJECT_ID
from core.datastore import entity_to_dict

AF_ID = "AF-003862"
AFCQ_ID = "AFCQ-003862"
DEFAULT_INCOTERM = "CNF"


def main():
    client = datastore.Client(project=PROJECT_ID)

    # ------------------------------------------------------------------
    # Step 1: Read Quotation AF-003862
    # ------------------------------------------------------------------
    print(f"Step 1: Reading Quotation {AF_ID}...")
    entity = client.get(client.key("Quotation", AF_ID))
    if not entity:
        print(f"  ERROR: Quotation {AF_ID} not found. Aborting.")
        sys.exit(1)

    record = entity_to_dict(entity)
    if record.get("data_version") != 2:
        print(f"  ERROR: data_version is {record.get('data_version')}, expected 2. Aborting.")
        sys.exit(1)

    current_incoterm = record.get("incoterm_code")
    if current_incoterm:
        print(f"  incoterm_code already set: {current_incoterm}")
        print("  Nothing to do — exiting (idempotent).")
        return

    print(f"  incoterm_code is {current_incoterm!r} — needs patching")

    # ------------------------------------------------------------------
    # Step 2: Check ShipmentOrder AFCQ-003862 for incoterm
    # ------------------------------------------------------------------
    print(f"\nStep 2: Checking ShipmentOrder {AFCQ_ID} for incoterm...")
    so_entity = client.get(client.key("ShipmentOrder", AFCQ_ID))
    so_incoterm = None
    if so_entity:
        so = entity_to_dict(so_entity)
        so_incoterm = so.get("incoterm_code") or so.get("incoterm") or None
        print(f"  ShipmentOrder incoterm: {so_incoterm!r}")
    else:
        print(f"  ShipmentOrder {AFCQ_ID} not found")

    # ------------------------------------------------------------------
    # Step 3: Check QuotationFreight AFCQ-003862 for incoterm
    # ------------------------------------------------------------------
    print(f"\nStep 3: Checking QuotationFreight {AFCQ_ID} for incoterm...")
    qf_entity = client.get(client.key("QuotationFreight", AFCQ_ID))
    qf_incoterm = None
    if qf_entity:
        qf = entity_to_dict(qf_entity)
        qf_incoterm = qf.get("incoterm_code") or qf.get("incoterm") or None
        print(f"  QuotationFreight incoterm: {qf_incoterm!r}")
    else:
        print(f"  QuotationFreight {AFCQ_ID} not found")

    # ------------------------------------------------------------------
    # Step 4: Determine best incoterm value
    # ------------------------------------------------------------------
    best_incoterm = so_incoterm or qf_incoterm or DEFAULT_INCOTERM
    source = (
        "ShipmentOrder" if so_incoterm
        else "QuotationFreight" if qf_incoterm
        else f"default ({DEFAULT_INCOTERM})"
    )
    print(f"\nStep 4: Best incoterm = {best_incoterm} (source: {source})")

    # ------------------------------------------------------------------
    # Step 5: Patch and write
    # ------------------------------------------------------------------
    print(f"\nStep 5: Patching Quotation {AF_ID}...")
    entity["incoterm_code"] = best_incoterm
    entity["updated"] = datetime.now(timezone.utc).isoformat()
    client.put(entity)
    print(f"  OK: incoterm_code set to {best_incoterm}")
    print(f"  Updated timestamp: {entity['updated']}")

    # ------------------------------------------------------------------
    # Done
    # ------------------------------------------------------------------
    print(f"\n{'=' * 50}")
    print(f"Fix complete: {AF_ID} incoterm_code = {best_incoterm}")
    print(f"  Source: {source}")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    main()
