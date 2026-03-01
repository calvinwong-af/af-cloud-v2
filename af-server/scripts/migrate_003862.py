"""
One-time migration: AFCQ-003862 → AF-003862

The main migration script (migrate_v1_to_v2.py) missed this record.
ShipmentOrder AFCQ-003862 exists with status=3001, superseded=True,
but Quotation AF-003862 was never created. This script creates it.

Run with: python -m scripts.migrate_003862
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google.cloud import datastore
from google.cloud.datastore.query import PropertyFilter

from core.constants import PROJECT_ID, STATUS_LABELS
from core.datastore import entity_to_dict, get_multi_chunked, parse_timestamp

AFCQ_ID = "AFCQ-003862"
AF_ID = "AF-003862"
NUMERIC = 3862


def main():
    client = datastore.Client(project=PROJECT_ID)
    migration_ts = datetime.now(timezone.utc).isoformat()

    # ------------------------------------------------------------------
    # Step 1: Read source entities
    # ------------------------------------------------------------------
    print(f"Step 1: Reading source entities for {AFCQ_ID}...")

    so_entity = client.get(client.key("ShipmentOrder", AFCQ_ID))
    if not so_entity:
        print(f"  ERROR: ShipmentOrder {AFCQ_ID} not found. Aborting.")
        sys.exit(1)
    so = entity_to_dict(so_entity)
    print(f"  ShipmentOrder {AFCQ_ID}: status={so.get('status')}, superseded={so.get('superseded')}")

    q_entity = client.get(client.key("Quotation", AFCQ_ID))
    q = entity_to_dict(q_entity) if q_entity else {}
    if q_entity:
        print(f"  Quotation {AFCQ_ID}: found")
    else:
        print(f"  Quotation {AFCQ_ID}: NOT FOUND (will use ShipmentOrder fields only)")

    # QuotationFreight for order_type derivation
    qf_entity = client.get(client.key("QuotationFreight", AFCQ_ID))
    qf = entity_to_dict(qf_entity) if qf_entity else {}

    # ------------------------------------------------------------------
    # Step 2: Idempotency check
    # ------------------------------------------------------------------
    existing = client.get(client.key("Quotation", AF_ID))
    if existing and existing.get("data_version") == 2 and existing.get("migrated_from_v1"):
        print(f"\n  {AF_ID} already exists and is migrated. Nothing to do.")
        return

    # ------------------------------------------------------------------
    # Step 3: Derive fields (same logic as migrate_v1_to_v2.py)
    # ------------------------------------------------------------------
    print("\nStep 2: Assembling V2 record...")

    # Order type
    freight_type = (qf.get("freight_type") or "").upper()
    container_load = (qf.get("container_load") or "").upper()
    if freight_type == "AIR":
        order_type = "AIR"
    elif container_load == "FCL":
        order_type = "SEA_FCL"
    elif container_load == "LCL":
        order_type = "SEA_LCL"
    else:
        order_type = "SEA_LCL"

    # Status — raw SO status is 3001 which is already a V2 code
    raw_status = so.get("status", 0)
    from core.constants import (
        V1_TO_V2_STATUS, STATUS_CONFIRMED, STATUS_BOOKING_PENDING,
        STATUS_BOOKING_CONFIRMED, STATUS_DEPARTED, STATUS_COMPLETED,
        STATUS_CANCELLED,
    )
    if raw_status in V1_TO_V2_STATUS:
        status = V1_TO_V2_STATUS[raw_status]
    elif raw_status in (STATUS_CONFIRMED, STATUS_BOOKING_PENDING, STATUS_BOOKING_CONFIRMED,
                        STATUS_DEPARTED, STATUS_COMPLETED, STATUS_CANCELLED):
        status = raw_status
    else:
        status = STATUS_CONFIRMED

    # Ports
    port_type = "AIR" if order_type == "AIR" else "PORT"
    origin_code = so.get("origin_port_un_code") or q.get("origin_port_un_code") or None
    dest_code = so.get("destination_port_un_code") or q.get("destination_port_un_code") or None

    origin = {
        "type": port_type, "port_un_code": origin_code,
        "terminal_id": None, "city_id": None, "address": None,
        "country_code": None, "label": origin_code,
    }
    destination = {
        "type": port_type, "port_un_code": dest_code,
        "terminal_id": None, "city_id": None, "address": None,
        "country_code": None, "label": dest_code,
    }

    # Parties
    parties = {"shipper": {"name": None, "address": None},
               "consignee": {"name": None, "address": None},
               "notify_party": {"name": None, "address": None}}

    # Try Quotation.parties first
    q_parties = q.get("parties")
    if q_parties and isinstance(q_parties, dict):
        if q_parties.get("shipper") or q_parties.get("consignee"):
            parties = {
                "shipper": q_parties.get("shipper") or {"name": None, "address": None},
                "consignee": q_parties.get("consignee") or {"name": None, "address": None},
                "notify_party": q_parties.get("notify_party") or {"name": None, "address": None},
            }

    # Booking
    so_booking = {}
    q_booking = q.get("booking") or {}
    if not isinstance(q_booking, dict):
        q_booking = {}
    booking = {
        "vessel_name": so.get("vessel_name") or q_booking.get("vessel_name") or None,
        "voyage_number": so.get("voyage_number") or q_booking.get("voyage_number") or None,
        "booking_reference": so.get("booking_reference") or q_booking.get("booking_reference") or None,
        "carrier": so.get("carrier") or q_booking.get("carrier") or None,
    }

    # Cargo
    cargo = {
        "description": qf.get("commodity") or "",
        "hs_code": qf.get("hs_code") or None,
        "is_dg": False,
    }
    cargo_type = qf.get("cargo_type")
    if cargo_type and isinstance(cargo_type, dict):
        cargo["is_dg"] = (cargo_type.get("code") or "").upper() == "DG"

    # Dates
    created_raw = q.get("created") or so.get("created")
    created_dt = parse_timestamp(created_raw) if created_raw else None
    created_iso = created_dt.isoformat() if created_dt else None

    # Company
    company_id = so.get("company_id") or q.get("company_id") or ""

    # Issued invoice
    issued_so = bool(so.get("issued_invoice", False))
    issued_q = bool(q.get("issued_invoice", False))
    issued_invoice = issued_so or issued_q

    # Assemble record
    record = {
        "data_version": 2,
        "migrated_from_v1": True,
        "migrated_from_id": AFCQ_ID,
        "migration_timestamp": migration_ts,
        "order_type": order_type,
        "transaction_type": (q.get("transaction_type") or "").upper() or None,
        "incoterm_code": q.get("incoterm_code") or q.get("incoterm") or None,
        "status": status,
        "status_history": q.get("status_history") or [],
        "origin": origin,
        "destination": destination,
        "cargo": cargo,
        "parties": parties,
        "booking": booking,
        "bl_document": q.get("bl_document") or None,
        "cargo_ready_date": None,
        "etd": None,
        "eta": None,
        "company_id": company_id,
        "issued_invoice": issued_invoice,
        "files": q.get("files") or [],
        "trash": False,
        "creator": q.get("creator") or None,
        "user": q.get("user") or None,
        "created": created_iso,
        "updated": migration_ts,
    }

    # Safe date conversion
    for date_field in ("cargo_ready_date", "etd", "eta"):
        val = q.get(date_field) or so.get(date_field)
        if val:
            if isinstance(val, str):
                record[date_field] = val
            else:
                dt = parse_timestamp(val)
                record[date_field] = dt.isoformat() if dt else str(val)

    status_label = STATUS_LABELS.get(status, str(status))
    print(f"  Order type: {order_type}")
    print(f"  Status: {status} ({status_label})")
    print(f"  Company: {company_id}")
    print(f"  Route: {origin_code} -> {dest_code}")
    print(f"  Incoterm: {record['incoterm_code']}")
    print(f"  Transaction: {record['transaction_type']}")

    # ------------------------------------------------------------------
    # Step 4: Write Quotation AF-003862
    # ------------------------------------------------------------------
    print(f"\nStep 3: Writing Quotation {AF_ID}...")
    key = client.key("Quotation", AF_ID)
    entity = datastore.Entity(key=key)
    entity.update(record)
    entity.exclude_from_indexes = {
        "status_history", "parties", "booking", "bl_document",
        "files", "origin", "destination", "cargo",
    }
    client.put(entity)
    print(f"  OK: Quotation {AF_ID} written")

    # ------------------------------------------------------------------
    # Step 5: Register ShipmentOrderV2CountId
    # ------------------------------------------------------------------
    print(f"\nStep 4: Registering ShipmentOrderV2CountId {AF_ID}...")
    cid_key = client.key("ShipmentOrderV2CountId", AF_ID)
    cid_entity = datastore.Entity(key=cid_key)
    cid_entity.update({
        "countid": NUMERIC,
        "created": migration_ts,
        "migrated_from_v1": True,
    })
    client.put(cid_entity)
    print(f"  OK: ShipmentOrderV2CountId {AF_ID} written (countid={NUMERIC})")

    # ------------------------------------------------------------------
    # Step 6: Re-key ShipmentWorkFlow
    # ------------------------------------------------------------------
    print(f"\nStep 5: Re-keying ShipmentWorkFlow...")
    old_wf = client.get(client.key("ShipmentWorkFlow", AFCQ_ID))
    if old_wf:
        new_wf_key = client.key("ShipmentWorkFlow", AF_ID)
        existing_wf = client.get(new_wf_key)
        if existing_wf:
            print(f"  ShipmentWorkFlow {AF_ID} already exists -- skipped")
        else:
            new_wf = datastore.Entity(key=new_wf_key)
            new_wf.update(dict(old_wf))
            new_wf["shipment_id"] = AF_ID
            try:
                exclude = set(old_wf.exclude_from_indexes or set())
                new_wf.exclude_from_indexes = exclude | {"status_history", "tasks"}
            except (TypeError, AttributeError):
                new_wf.exclude_from_indexes = {"status_history", "tasks"}
            client.put(new_wf)
            print(f"  OK: ShipmentWorkFlow {AF_ID} written")
    else:
        # Create minimal ShipmentWorkFlow
        new_wf_key = client.key("ShipmentWorkFlow", AF_ID)
        new_wf = datastore.Entity(key=new_wf_key)
        new_wf.update({
            "shipment_id": AF_ID,
            "status_history": [],
            "tasks": [],
            "created": migration_ts,
        })
        new_wf.exclude_from_indexes = {"status_history", "tasks"}
        client.put(new_wf)
        print(f"  OK: ShipmentWorkFlow {AF_ID} created (minimal -- no source found)")

    # ------------------------------------------------------------------
    # Step 7: Re-key Files
    # ------------------------------------------------------------------
    print(f"\nStep 6: Re-keying Files...")
    file_query = client.query(kind="Files")
    file_query.add_filter(filter=PropertyFilter("shipment_order_id", "=", AFCQ_ID))
    file_entities = list(file_query.fetch())
    if file_entities:
        for fe in file_entities:
            fe["shipment_order_id"] = AF_ID
        client.put_multi(file_entities)
        print(f"  OK: {len(file_entities)} Files re-keyed to {AF_ID}")
    else:
        print(f"  No Files found for {AFCQ_ID}")

    # ------------------------------------------------------------------
    # Done
    # ------------------------------------------------------------------
    print(f"\n{'=' * 50}")
    print(f"Migration complete: {AFCQ_ID} -> {AF_ID}")
    print(f"  Quotation {AF_ID}: written (status={status} {status_label})")
    print(f"  ShipmentOrderV2CountId: registered (countid={NUMERIC})")
    print(f"  ShipmentOrder {AFCQ_ID}: untouched (superseded=True)")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    main()
