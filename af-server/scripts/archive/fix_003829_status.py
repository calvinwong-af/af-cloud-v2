"""
fix_003829_status.py

One-time fix: advance AFCQ-003829 ShipmentOrder status from 100 → 4110
(V1_STATUS_IN_TRANSIT, equivalent to V2 Departed) to match the actual
operational state recorded in the Quotation record.

Safe to run multiple times (idempotent — checks current status before writing).

Usage:
  python scripts/fix_003829_status.py --dry-run   # preview only
  python scripts/fix_003829_status.py              # live run
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google.cloud import datastore
from core.constants import PROJECT_ID

SHIPMENT_ID = "AFCQ-003829"
TARGET_STATUS = 4110  # V1_STATUS_IN_TRANSIT → V2 Departed


def main():
    dry_run = "--dry-run" in sys.argv
    mode = "DRY RUN" if dry_run else "LIVE"
    print(f"=== Fix {SHIPMENT_ID} ShipmentOrder status — {mode} ===\n")

    client = datastore.Client(project=PROJECT_ID)

    key = client.key("ShipmentOrder", SHIPMENT_ID)
    entity = client.get(key)

    if not entity:
        print(f"ERROR: ShipmentOrder {SHIPMENT_ID} not found in Datastore")
        sys.exit(1)

    current_status = entity.get("status")
    print(f"Current status: {current_status}")

    if current_status is not None and current_status >= TARGET_STATUS:
        print(f"Already at {current_status} (>= {TARGET_STATUS}), no change needed.")
        return

    print(f"Will change: {current_status} → {TARGET_STATUS}")

    if dry_run:
        print("\n[DRY RUN] No changes written.")
        return

    entity["status"] = TARGET_STATUS
    entity["updated"] = datetime.now(timezone.utc).isoformat()
    client.put(entity)

    print(f"\nDone: {SHIPMENT_ID} ShipmentOrder status updated {current_status} → {TARGET_STATUS}")


if __name__ == "__main__":
    main()
