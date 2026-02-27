"""
scripts/remap_status_codes.py

Migration script: remap all ShipmentOrder records from old status codes
to new v2.18 status codes.

Old → New mapping (from core/constants.py OLD_TO_NEW_STATUS):
  1001 → 1001   Draft
  1002 → 1002   Pending Review
  2001 → 2001   Confirmed
  2002 → 3001   Booking Pending (moved to 3xxx)
  3001 → 3002   Booked → Booking Confirmed (moved to 3xxx)
  3002 → 4001   In Transit → Departed (moved to 4xxx)
  3003 → 4002   Arrived (moved to 4xxx)
  4001 → 4001   Clearance In Progress → Departed (collapsed)
  4002 → flag   Exception → set exception.flagged = True, status → 4001
  5001 → 5001   Completed
  -1   → -1     Cancelled

Usage:
  python -m scripts.remap_status_codes --dry-run
  python -m scripts.remap_status_codes --live
"""

import argparse
import sys
from datetime import datetime, timezone

from google.cloud.datastore.query import PropertyFilter

# Ensure project imports work
sys.path.insert(0, ".")

from core.datastore import get_client
from core.constants import OLD_TO_NEW_STATUS, STATUS_LABELS


OLD_EXCEPTION_STATUS = 4002
FALLBACK_STATUS_FOR_EXCEPTION = 4001  # Departed


def remap_records(dry_run: bool = True) -> None:
    client = get_client()
    now = datetime.now(timezone.utc).isoformat()

    # -----------------------------------------------------------------------
    # Phase 1: V2 records in Quotation Kind (data_version=2)
    # -----------------------------------------------------------------------
    print("\n=== Phase 1: V2 Quotation records (data_version=2) ===\n")
    v2_query = client.query(kind="Quotation")
    v2_query.add_filter(filter=PropertyFilter("data_version", "=", 2))

    v2_changed = 0
    v2_exception = 0
    v2_skipped = 0

    for entity in v2_query.fetch():
        sid = entity.key.name or str(entity.key.id)
        old_status = entity.get("status", 0)

        if old_status == OLD_EXCEPTION_STATUS:
            # Special case: Exception status → set flag + remap to Departed
            new_status = FALLBACK_STATUS_FOR_EXCEPTION
            print(f"  [EXCEPTION] {sid}: {old_status} → {new_status} + exception.flagged=True")
            if not dry_run:
                entity["status"] = new_status
                entity["exception"] = {
                    "flagged": True,
                    "raised_at": now,
                    "raised_by": "migration",
                    "notes": "Migrated from Exception status",
                }
                entity["updated"] = now
                client.put(entity)
            v2_exception += 1
            v2_changed += 1

        elif old_status in OLD_TO_NEW_STATUS:
            new_status = OLD_TO_NEW_STATUS[old_status]
            if old_status != new_status:
                label = STATUS_LABELS.get(new_status, str(new_status))
                print(f"  {sid}: {old_status} → {new_status} ({label})")
                if not dry_run:
                    entity["status"] = new_status
                    entity["updated"] = now
                    client.put(entity)
                v2_changed += 1
            else:
                v2_skipped += 1
        else:
            print(f"  [UNKNOWN] {sid}: status {old_status} — no mapping, skipping")
            v2_skipped += 1

    print(f"\n  V2 Quotation: {v2_changed} changed, {v2_exception} exceptions flagged, {v2_skipped} unchanged")

    # -----------------------------------------------------------------------
    # Phase 2: Migrated records in ShipmentOrder Kind (data_version=2)
    # -----------------------------------------------------------------------
    print("\n=== Phase 2: Migrated ShipmentOrder records (data_version=2) ===\n")
    mig_query = client.query(kind="ShipmentOrder")
    mig_query.add_filter(filter=PropertyFilter("data_version", "=", 2))

    mig_changed = 0
    mig_exception = 0
    mig_skipped = 0

    for entity in mig_query.fetch():
        sid = entity.key.name or str(entity.key.id)
        old_status = entity.get("status", 0)

        if old_status == OLD_EXCEPTION_STATUS:
            new_status = FALLBACK_STATUS_FOR_EXCEPTION
            print(f"  [EXCEPTION] {sid}: {old_status} → {new_status} + exception.flagged=True")
            if not dry_run:
                entity["status"] = new_status
                entity["exception"] = {
                    "flagged": True,
                    "raised_at": now,
                    "raised_by": "migration",
                    "notes": "Migrated from Exception status",
                }
                entity["updated"] = now
                client.put(entity)
            mig_exception += 1
            mig_changed += 1

        elif old_status in OLD_TO_NEW_STATUS:
            new_status = OLD_TO_NEW_STATUS[old_status]
            if old_status != new_status:
                label = STATUS_LABELS.get(new_status, str(new_status))
                print(f"  {sid}: {old_status} → {new_status} ({label})")
                if not dry_run:
                    entity["status"] = new_status
                    entity["updated"] = now
                    client.put(entity)
                mig_changed += 1
            else:
                mig_skipped += 1
        else:
            print(f"  [UNKNOWN] {sid}: status {old_status} — no mapping, skipping")
            mig_skipped += 1

    print(f"\n  Migrated ShipmentOrder: {mig_changed} changed, {mig_exception} exceptions flagged, {mig_skipped} unchanged")

    # -----------------------------------------------------------------------
    # Phase 3: Also remap status_history entries on ShipmentWorkFlow
    # -----------------------------------------------------------------------
    print("\n=== Phase 3: ShipmentWorkFlow status_history entries ===\n")
    wf_query = client.query(kind="ShipmentWorkFlow")
    wf_changed = 0

    for entity in wf_query.fetch():
        sid = entity.key.name or str(entity.key.id)
        history = entity.get("status_history") or []
        changed = False

        for entry in history:
            old_s = entry.get("status")
            if old_s and old_s in OLD_TO_NEW_STATUS and OLD_TO_NEW_STATUS[old_s] != old_s:
                new_s = OLD_TO_NEW_STATUS[old_s]
                entry["status"] = new_s
                entry["status_label"] = STATUS_LABELS.get(new_s, str(new_s))
                # Also update "label" field if present (Quotation-style history)
                if "label" in entry:
                    entry["label"] = STATUS_LABELS.get(new_s, str(new_s))
                changed = True
            elif old_s == OLD_EXCEPTION_STATUS:
                entry["status"] = FALLBACK_STATUS_FOR_EXCEPTION
                entry["status_label"] = STATUS_LABELS.get(FALLBACK_STATUS_FOR_EXCEPTION, str(FALLBACK_STATUS_FOR_EXCEPTION))
                if "label" in entry:
                    entry["label"] = STATUS_LABELS.get(FALLBACK_STATUS_FOR_EXCEPTION, str(FALLBACK_STATUS_FOR_EXCEPTION))
                changed = True

        if changed:
            print(f"  {sid}: status_history entries remapped")
            if not dry_run:
                entity["status_history"] = history
                entity["updated"] = now
                entity.exclude_from_indexes = set(entity.exclude_from_indexes or set()) | {"status_history"}
                client.put(entity)
            wf_changed += 1

    print(f"\n  ShipmentWorkFlow: {wf_changed} records with history remapped")

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    total = v2_changed + mig_changed + wf_changed
    mode = "DRY RUN" if dry_run else "LIVE"
    print(f"\n{'='*60}")
    print(f"  [{mode}] Total records affected: {total}")
    print(f"  V2 Quotation: {v2_changed} | Migrated SO: {mig_changed} | Workflow: {wf_changed}")
    if dry_run:
        print("  Re-run with --live to apply changes.")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Remap old status codes to new v2.18 codes")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="Print changes without writing")
    group.add_argument("--live", action="store_true", help="Apply changes to Datastore")
    args = parser.parse_args()

    remap_records(dry_run=not args.live)
