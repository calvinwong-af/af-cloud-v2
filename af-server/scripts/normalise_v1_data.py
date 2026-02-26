"""
scripts/normalise_v1_data.py

S3 — V1 Data Normalisation (one-off migration)

Fixes three inconsistencies in V1 Datastore records:

  1. issued_invoice  — stored as bool, int (0/1), or missing on Quotation Kind.
                       Normalise to bool True/False.

  2. has_shipment    — verify all Quotation records that have a corresponding
                       ShipmentOrder entity have has_shipment=True.

  3. account_type    — backfill UserIAM.account_type from UserAccount for
                       pre-V2 users where UserIAM was created without it.

Run this as a one-off Cloud Run job, or locally with:
  GOOGLE_APPLICATION_CREDENTIALS=./key.json python scripts/normalise_v1_data.py

DO NOT run against production without a dry_run=True pass first.
"""

import os
import sys
from google.cloud import datastore

DRY_RUN = os.environ.get("DRY_RUN", "true").lower() != "false"
PROJECT_ID = "cloud-accele-freight"

client = datastore.Client(project=PROJECT_ID)


def normalise_issued_invoice():
    """Fix Quotation.issued_invoice — coerce int/None → bool."""
    print("\n[1/3] Normalising issued_invoice on Quotation Kind...")
    query = client.query(kind="Quotation")
    # Only V1 records (no data_version field)
    updated = 0
    skipped = 0
    for entity in query.fetch():
        if entity.get("data_version") == 2:
            skipped += 1
            continue
        raw = entity.get("issued_invoice")
        if isinstance(raw, bool):
            skipped += 1
            continue
        # Coerce: 0/None/missing → False, 1/"true"/etc → True
        normalised = bool(raw) if raw is not None else False
        entity["issued_invoice"] = normalised
        updated += 1
        if not DRY_RUN:
            client.put(entity)
        else:
            print(f"  [DRY RUN] Would set {entity.key.name}.issued_invoice = {normalised} (was {raw!r})")

    print(f"  Updated: {updated}, Skipped (already bool or V2): {skipped}")


def normalise_has_shipment():
    """Ensure all Quotation records with a ShipmentOrder have has_shipment=True."""
    print("\n[2/3] Normalising has_shipment on Quotation Kind...")
    query = client.query(kind="ShipmentOrder")
    updated = 0
    missing_quotation = 0

    for so_entity in query.fetch():
        quotation_id = so_entity.get("quotation_id") or so_entity.get("shipment_order_id")
        if not quotation_id:
            continue

        q_entity = client.get(client.key("Quotation", quotation_id))
        if not q_entity:
            missing_quotation += 1
            continue

        if q_entity.get("has_shipment") is not True:
            q_entity["has_shipment"] = True
            updated += 1
            if not DRY_RUN:
                client.put(q_entity)
            else:
                print(f"  [DRY RUN] Would set {quotation_id}.has_shipment = True")

    print(f"  Updated: {updated}, ShipmentOrders with missing Quotation: {missing_quotation}")


def backfill_user_iam_account_type():
    """Backfill UserIAM.account_type from UserAccount for pre-V2 users."""
    print("\n[3/3] Backfilling account_type on UserIAM Kind...")
    query = client.query(kind="UserIAM")
    updated = 0
    skipped = 0

    for iam_entity in query.fetch():
        if iam_entity.get("account_type"):
            skipped += 1
            continue

        uid = iam_entity.key.name
        account_entity = client.get(client.key("UserAccount", uid))
        if not account_entity or not account_entity.get("account_type"):
            skipped += 1
            continue

        account_type = account_entity.get("account_type")
        iam_entity["account_type"] = account_type
        updated += 1

        if not DRY_RUN:
            client.put(iam_entity)
        else:
            print(f"  [DRY RUN] Would set UserIAM[{uid}].account_type = {account_type}")

    print(f"  Updated: {updated}, Skipped (already set or no UserAccount): {skipped}")


if __name__ == "__main__":
    mode = "DRY RUN" if DRY_RUN else "LIVE"
    print(f"=== V1 Data Normalisation — {mode} MODE ===")
    if not DRY_RUN:
        confirm = input("Running in LIVE mode. Type 'yes' to continue: ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            sys.exit(0)

    normalise_issued_invoice()
    normalise_has_shipment()
    backfill_user_iam_account_type()

    print(f"\n=== Done ({mode}) ===")
