"""
scripts/migrate_v1_to_v2.py

V1->V2 Full Migration -- Prefix Re-key + Code Cleanup.

Reads all V1 AFCQ- records, assembles them into unified V2 Quotation Kind
entities with AF- prefix keys, re-keys ShipmentWorkFlow and Files, and
registers AF- keys in ShipmentOrderV2CountId.

Old records are never modified or deleted.

Usage:
    .venv\\Scripts\\python scripts/migrate_v1_to_v2.py                    # dry run
    .venv\\Scripts\\python scripts/migrate_v1_to_v2.py --commit            # live run
    .venv\\Scripts\\python scripts/migrate_v1_to_v2.py --commit --only AFCQ-003829
"""

import argparse
import logging
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# Ensure af-server root is on sys.path so core.* imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google.cloud import datastore
from google.cloud.datastore.query import PropertyFilter

from core.constants import (
    ORDER_TYPE_AIR,
    ORDER_TYPE_SEA_FCL,
    ORDER_TYPE_SEA_LCL,
    PREFIX_V1_SHIPMENT,
    PREFIX_V2_SHIPMENT,
    PROJECT_ID,
    STATUS_BOOKING_CONFIRMED,
    STATUS_BOOKING_PENDING,
    STATUS_CANCELLED,
    STATUS_COMPLETED,
    STATUS_CONFIRMED,
    STATUS_DEPARTED,
    STATUS_DRAFT,
    STATUS_LABELS,
    V1_TO_V2_STATUS,
)
from core.datastore import entity_to_dict, get_multi_chunked, parse_timestamp

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
WRITE_CHUNK_SIZE = 500

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers — order type, status, parties, booking, type details
# ---------------------------------------------------------------------------

def _derive_order_type(q_freight: dict) -> str:
    """Derive V2 order_type from V1 QuotationFreight fields."""
    freight_type = (q_freight.get("freight_type") or "").upper()
    container_load = (q_freight.get("container_load") or "").upper()

    if freight_type == "AIR":
        return ORDER_TYPE_AIR
    elif container_load == "FCL":
        return ORDER_TYPE_SEA_FCL
    elif container_load == "LCL":
        return ORDER_TYPE_SEA_LCL
    else:
        return ORDER_TYPE_SEA_LCL  # default


def _derive_status(quotation: dict, shipment_order: dict | None) -> int:
    """Map V1 status to V2 status code.

    If ShipmentOrder exists, use its status as source of truth.
    V2 codes already stored on SO (e.g. 3002, 4001) pass through.
    """
    if shipment_order:
        raw = shipment_order.get("status", 0)
        if raw in V1_TO_V2_STATUS:
            return V1_TO_V2_STATUS[raw]
        # V2 code already written on V1 record — pass through
        if raw in (STATUS_CONFIRMED, STATUS_BOOKING_PENDING, STATUS_BOOKING_CONFIRMED,
                   STATUS_DEPARTED, STATUS_COMPLETED, STATUS_CANCELLED):
            return raw
        return STATUS_CONFIRMED  # fallback

    return STATUS_CONFIRMED  # no ShipmentOrder — safe default


def _safe_date_str(value) -> str | None:
    """Convert a date/datetime value to ISO string."""
    if not value:
        return None
    if isinstance(value, str):
        return value
    dt = parse_timestamp(value)
    return dt.isoformat() if dt else str(value)


def _build_party(shipment_order: dict | None, field_name: str) -> dict:
    """Extract a party (shipper/consignee/notify_party) from ShipmentOrder."""
    if not shipment_order:
        return {"name": None, "address": None}

    party = shipment_order.get(field_name)
    if not party or not isinstance(party, dict):
        return {"name": None, "address": None}

    name = party.get("company_contact_name") or party.get("tag") or None

    addr_entity = party.get("address")
    address = None
    if addr_entity and isinstance(addr_entity, dict):
        parts = [
            addr_entity.get("line_1"),
            addr_entity.get("line_2"),
            addr_entity.get("line_3"),
            addr_entity.get("city"),
            addr_entity.get("state"),
            addr_entity.get("postcode"),
            addr_entity.get("country"),
        ]
        addr_str = ", ".join(p for p in parts if p)
        address = addr_str or None

    return {"name": name, "address": address}


def _build_parties(quotation: dict, shipment_order: dict | None) -> dict:
    """Build parties dict using v1-assembly.ts priority order:
    1. Quotation.parties (modern dict)
    2. ShipmentOrder structured objects
    3. ShipmentOrder flat fields
    4. Quotation flat fields
    """
    # Priority 1: Quotation.parties dict
    q_parties = quotation.get("parties")
    if q_parties and isinstance(q_parties, dict):
        has_any = (
            q_parties.get("shipper")
            or q_parties.get("consignee")
            or q_parties.get("notify_party")
        )
        if has_any:
            return {
                "shipper": q_parties.get("shipper") or {"name": None, "address": None},
                "consignee": q_parties.get("consignee") or {"name": None, "address": None},
                "notify_party": q_parties.get("notify_party") or {"name": None, "address": None},
            }

    # Priority 2: ShipmentOrder structured objects
    if shipment_order:
        so_shipper = shipment_order.get("shipper")
        so_consignee = shipment_order.get("consignee")
        so_notify = shipment_order.get("notify_party")
        if (so_shipper and isinstance(so_shipper, dict)) or \
           (so_consignee and isinstance(so_consignee, dict)):
            return {
                "shipper": _build_party(shipment_order, "shipper"),
                "consignee": _build_party(shipment_order, "consignee"),
                "notify_party": _build_party(shipment_order, "notify_party"),
            }

    # Priority 3: ShipmentOrder flat fields
    if shipment_order:
        sn = shipment_order.get("shipper_name")
        cn = shipment_order.get("consignee_name")
        if sn or cn:
            return {
                "shipper": {"name": sn or None, "address": shipment_order.get("shipper_address") or None},
                "consignee": {"name": cn or None, "address": shipment_order.get("consignee_address") or None},
                "notify_party": {"name": None, "address": None},
            }

    # Priority 4: Quotation flat fields
    sn = quotation.get("shipper_name")
    cn = quotation.get("consignee_name")
    if sn or cn:
        return {
            "shipper": {"name": sn or None, "address": quotation.get("shipper_address") or None},
            "consignee": {"name": cn or None, "address": quotation.get("consignee_address") or None},
            "notify_party": {"name": None, "address": None},
        }

    return {
        "shipper": {"name": None, "address": None},
        "consignee": {"name": None, "address": None},
        "notify_party": {"name": None, "address": None},
    }


def _build_booking(quotation: dict, shipment_order: dict | None) -> dict:
    """Build booking dict. ShipmentOrder fields take precedence."""
    so = shipment_order or {}
    q_booking = quotation.get("booking") or {}
    if not isinstance(q_booking, dict):
        q_booking = {}

    # ShipmentOrder flat fields
    vessel = so.get("vessel_name") or q_booking.get("vessel_name") or None
    voyage = so.get("voyage_number") or q_booking.get("voyage_number") or None
    booking_ref = so.get("booking_reference") or q_booking.get("booking_reference") or None
    carrier = so.get("carrier") or q_booking.get("carrier") or None

    return {
        "vessel_name": vessel,
        "voyage_number": voyage,
        "booking_reference": booking_ref,
        "carrier": carrier,
    }


def _build_origin_dest(quotation: dict, shipment_order: dict | None, order_type: str) -> tuple[dict, dict]:
    """Build origin and destination location dicts."""
    port_type = "AIR" if order_type == ORDER_TYPE_AIR else "PORT"
    so = shipment_order or {}

    origin_code = so.get("origin_port_un_code") or quotation.get("origin_port_un_code") or None
    dest_code = so.get("destination_port_un_code") or quotation.get("destination_port_un_code") or None

    origin = {
        "type": port_type,
        "port_un_code": origin_code,
        "terminal_id": None,
        "city_id": None,
        "address": None,
        "country_code": None,
        "label": origin_code,
    }
    destination = {
        "type": port_type,
        "port_un_code": dest_code,
        "terminal_id": None,
        "city_id": None,
        "address": None,
        "country_code": None,
        "label": dest_code,
    }
    return origin, destination


def _is_dangerous_goods(q_freight: dict) -> bool:
    """Check if QuotationFreight indicates dangerous goods."""
    cargo_type = q_freight.get("cargo_type")
    if cargo_type and isinstance(cargo_type, dict):
        return (cargo_type.get("code") or "").upper() == "DG"
    return False


# ---------------------------------------------------------------------------
# Batch fetch helpers
# ---------------------------------------------------------------------------

def _build_lookup(entities: list) -> dict:
    """Build a {key_name: dict} lookup from entity list."""
    lookup = {}
    for e in entities:
        name = e.key.name or str(e.key.id)
        lookup[name] = entity_to_dict(e)
    return lookup


def _fetch_kind_by_keys(client: datastore.Client, kind: str, key_names: list[str]) -> dict:
    """Batch-fetch a Kind by key names and return a {key_name: dict} lookup."""
    keys = [client.key(kind, name) for name in key_names]
    entities = get_multi_chunked(client, keys)
    return _build_lookup(entities)


def _afcq_to_af(afcq_id: str) -> str:
    """Convert AFCQ-XXXXXX to AF-XXXXXX."""
    numeric = afcq_id[5:]  # strip "AFCQ-"
    return f"AF-{numeric}"


# ---------------------------------------------------------------------------
# Record assembly
# ---------------------------------------------------------------------------

def assemble_v2_record(
    afcq_id: str,
    quotation: dict,
    q_freight: dict | None,
    shipment_order: dict | None,
    issued_invoice: bool,
    migration_ts: str,
) -> dict:
    """Assemble one V2 Quotation record from V1 source Kinds."""
    q_freight = q_freight or {}

    order_type = _derive_order_type(q_freight)
    status = _derive_status(quotation, shipment_order)
    parties = _build_parties(quotation, shipment_order)
    booking = _build_booking(quotation, shipment_order)
    origin, destination = _build_origin_dest(quotation, shipment_order, order_type)

    # Dates
    created_raw = quotation.get("created")
    created_dt = parse_timestamp(created_raw)
    created_iso = created_dt.isoformat() if created_dt else None

    # Company — prefer ShipmentOrder, fallback Quotation
    company_id = None
    if shipment_order:
        company_id = shipment_order.get("company_id") or None
    if not company_id:
        company_id = quotation.get("company_id") or ""

    return {
        # Identity
        "data_version": 2,
        "migrated_from_v1": True,
        "migration_timestamp": migration_ts,
        # Classification
        "order_type": order_type,
        "transaction_type": (quotation.get("transaction_type") or "").upper() or None,
        "incoterm_code": quotation.get("incoterm_code") or None,
        # Status
        "status": status,
        "status_history": quotation.get("status_history") or [],
        # Location
        "origin": origin,
        "destination": destination,
        # Cargo
        "cargo": {
            "description": q_freight.get("commodity") or "",
            "hs_code": q_freight.get("hs_code") or None,
            "is_dg": _is_dangerous_goods(q_freight),
        },
        # Parties
        "parties": parties,
        # Booking
        "booking": booking,
        # BL
        "bl_document": quotation.get("bl_document") or None,
        # Dates
        "cargo_ready_date": _safe_date_str(quotation.get("cargo_ready_date")),
        "etd": _safe_date_str(quotation.get("etd")),
        "eta": _safe_date_str(quotation.get("eta")),
        # References
        "company_id": company_id,
        "issued_invoice": issued_invoice,
        # Files
        "files": quotation.get("files") or [],
        # Soft delete
        "trash": bool(quotation.get("trash", False)),
        # Audit
        "creator": quotation.get("creator") or None,
        "user": quotation.get("user") or None,
        "created": created_iso,
        "updated": migration_ts,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="V1->V2 Migration -- Prefix Re-key")
    parser.add_argument("--commit", action="store_true", help="Write changes (default: dry run)")
    parser.add_argument("--only", type=str, help="Migrate a single AFCQ- record only")
    args = parser.parse_args()

    dry_run = not args.commit
    mode = "DRY RUN" if dry_run else "LIVE"
    print(f"=== V1->V2 Migration -- {mode} MODE ===\n")

    client = datastore.Client(project=PROJECT_ID)
    migration_ts = datetime.now(timezone.utc).isoformat()

    # ===================================================================
    # Step 1 — Pre-flight checks
    # ===================================================================
    print("Step 1: Pre-flight checks...")

    # Count AFCQ- ShipmentOrder records
    so_query = client.query(kind="ShipmentOrder")
    so_query.keys_only()
    all_so_keys = list(so_query.fetch())
    afcq_so_count = sum(1 for e in all_so_keys if (e.key.name or "").startswith(PREFIX_V1_SHIPMENT))
    print(f"  AFCQ- ShipmentOrder records: {afcq_so_count}")

    # Count existing AF- Quotation records (data_version=2)
    v2_query = client.query(kind="Quotation")
    v2_query.add_filter(filter=PropertyFilter("data_version", "=", 2))
    v2_query.keys_only()
    v2_keys = list(v2_query.fetch())
    af_v2_count = len(v2_keys)
    print(f"  Existing AF- Quotation records (data_version=2): {af_v2_count}")

    # Collision check
    af_nums = set()
    for e in v2_keys:
        name = e.key.name or ""
        if name.startswith(PREFIX_V2_SHIPMENT):
            try:
                af_nums.add(int(name[3:]))
            except ValueError:
                pass

    afcq_nums = set()
    for e in all_so_keys:
        name = e.key.name or ""
        if name.startswith(PREFIX_V1_SHIPMENT):
            try:
                afcq_nums.add(int(name[5:]))
            except ValueError:
                pass

    collision = af_nums & afcq_nums
    if collision:
        print(f"\n  *** COLLISION DETECTED! {len(collision)} overlapping numbers: {sorted(collision)[:10]}...")
        print("  Aborting migration.")
        sys.exit(1)
    else:
        print(f"  No numeric collision between AFCQ- range and AF- range. Safe to proceed.")

    # ===================================================================
    # Step 2 — Fetch all V1 source data
    # ===================================================================
    print("\nStep 2: Fetching V1 source data...")

    # Fetch all V1 Quotation records (AFCQ- prefix)
    q_query = client.query(kind="Quotation")
    all_quotations = list(q_query.fetch())

    v1_quotations = []
    for entity in all_quotations:
        if entity.get("data_version") == 2:
            continue
        key_name = entity.key.name or str(entity.key.id)
        if not key_name.startswith(PREFIX_V1_SHIPMENT):
            continue
        v1_quotations.append(entity)

    print(f"  V1 Quotation records: {len(v1_quotations)}")

    # Apply --only filter
    if args.only:
        v1_quotations = [e for e in v1_quotations if (e.key.name or str(e.key.id)) == args.only]
        print(f"  Filtered to --only {args.only}: {len(v1_quotations)} records")
        if not v1_quotations:
            print(f"  Record {args.only} not found among V1 Quotations. Aborting.")
            sys.exit(1)

    afcq_ids = [e.key.name or str(e.key.id) for e in v1_quotations]
    quotation_lookup = {(e.key.name or str(e.key.id)): entity_to_dict(e) for e in v1_quotations}

    # Check which AF- keys already exist (idempotency)
    af_ids_to_check = [_afcq_to_af(sid) for sid in afcq_ids]
    af_keys = [client.key("Quotation", af_id) for af_id in af_ids_to_check]
    existing_af = get_multi_chunked(client, af_keys)
    already_migrated = set()
    for e in existing_af:
        if e.get("data_version") == 2 and e.get("migrated_from_v1"):
            already_migrated.add(e.key.name or str(e.key.id))

    # Filter out already-migrated
    ids_to_migrate = []
    for afcq_id in afcq_ids:
        af_id = _afcq_to_af(afcq_id)
        if af_id in already_migrated:
            continue
        ids_to_migrate.append(afcq_id)

    skipped_already = len(afcq_ids) - len(ids_to_migrate)
    print(f"  Already migrated (skipped): {skipped_already}")
    print(f"  To migrate: {len(ids_to_migrate)}")
    # Note: records without a ShipmentOrder will be skipped in Step 3
    print(f"  (Records without ShipmentOrder will be skipped — unconfirmed quotations)")

    if not ids_to_migrate:
        print("\nNo records to migrate.")
        _print_report(mode, len(afcq_ids), skipped_already, 0, 0, {}, {}, [], [], 0, 0, 0, 0)
        return

    # Batch-fetch related Kinds
    print("  Batch-fetching related Kinds...")
    so_lookup = _fetch_kind_by_keys(client, "ShipmentOrder", ids_to_migrate)
    freight_lookup = _fetch_kind_by_keys(client, "QuotationFreight", ids_to_migrate)
    print(f"    ShipmentOrder: {len(so_lookup)}, QuotationFreight: {len(freight_lookup)}")

    # ===================================================================
    # Step 3 — Assemble V2 records (with inline issued_invoice resolution)
    # ===================================================================
    print("\nStep 3: Assembling V2 records...")

    v2_records: list[tuple[str, str, dict]] = []  # (afcq_id, af_id, record)
    errors: list[tuple[str, str]] = []
    type_counts: dict[str, int] = defaultdict(int)
    status_counts: dict[int, int] = defaultdict(int)
    active_orders: list[tuple[str, str, int]] = []  # (afcq_id, af_id, status)
    assembly_count = 0
    skipped_no_so = 0

    for afcq_id in ids_to_migrate:
        af_id = _afcq_to_af(afcq_id)
        quotation = quotation_lookup[afcq_id]
        q_freight = freight_lookup.get(afcq_id)
        shipment_order = so_lookup.get(afcq_id)

        # Skip unconfirmed orphan quotations (no ShipmentOrder)
        if not shipment_order:
            skipped_no_so += 1
            log.debug("Skipping %s — no ShipmentOrder (unconfirmed quotation)", afcq_id)
            continue

        # Inline issued_invoice resolution (Step 2 from prompt)
        issued_so = bool(shipment_order.get("issued_invoice", False)) if shipment_order else False
        issued_q = bool(quotation.get("issued_invoice", False))
        issued_invoice = issued_so or issued_q

        try:
            record = assemble_v2_record(
                afcq_id=afcq_id,
                quotation=quotation,
                q_freight=q_freight,
                shipment_order=shipment_order,
                issued_invoice=issued_invoice,
                migration_ts=migration_ts,
            )
            v2_records.append((afcq_id, af_id, record))
            assembly_count += 1

            type_counts[record["order_type"]] += 1
            status_counts[record["status"]] += 1

            st = record["status"]
            if st != STATUS_CANCELLED and st != STATUS_COMPLETED:
                active_orders.append((afcq_id, af_id, st))

        except Exception as e:
            errors.append((afcq_id, str(e)))
            log.error("Failed to assemble %s: %s", afcq_id, e)

    print(f"  Assembled: {assembly_count}, Skipped (no ShipmentOrder): {skipped_no_so}, Errors: {len(errors)}")

    # ===================================================================
    # Step 4 — Re-key ShipmentWorkFlow
    # ===================================================================
    print("\nStep 4: Re-keying ShipmentWorkFlow...")
    wf_rekey_count = 0

    wf_old_keys = [client.key("ShipmentWorkFlow", afcq_id) for afcq_id, _, _ in v2_records]
    wf_entities = get_multi_chunked(client, wf_old_keys)
    wf_lookup = {(e.key.name or str(e.key.id)): e for e in wf_entities}

    wf_new_entities = []
    for afcq_id, af_id, _ in v2_records:
        old_wf = wf_lookup.get(afcq_id)
        if not old_wf:
            continue

        # Check if new key already exists (idempotency)
        new_wf_key = client.key("ShipmentWorkFlow", af_id)
        existing = client.get(new_wf_key)
        if existing:
            continue

        new_wf = datastore.Entity(key=new_wf_key)
        new_wf.update(dict(old_wf))
        new_wf["shipment_id"] = af_id
        # Exclude large fields from indexes
        try:
            exclude = set(old_wf.exclude_from_indexes or set())
            new_wf.exclude_from_indexes = exclude | {"status_history", "tasks"}
        except (TypeError, AttributeError):
            new_wf.exclude_from_indexes = {"status_history", "tasks"}
        wf_new_entities.append(new_wf)
        wf_rekey_count += 1

    print(f"  ShipmentWorkFlow to re-key: {wf_rekey_count}")

    # ===================================================================
    # Step 5 — Re-key Files
    # ===================================================================
    print("\nStep 5: Re-keying Files...")
    files_updated_count = 0

    file_entities_to_update = []
    for afcq_id, af_id, _ in v2_records:
        file_query = client.query(kind="Files")
        file_query.add_filter(filter=PropertyFilter("shipment_order_id", "=", afcq_id))
        for file_entity in file_query.fetch():
            file_entity["shipment_order_id"] = af_id
            file_entities_to_update.append(file_entity)
            files_updated_count += 1

    print(f"  Files to update: {files_updated_count}")

    # ===================================================================
    # Step 6 — Register new AF- keys in ShipmentOrderV2CountId
    # ===================================================================
    print("\nStep 6: Registering ShipmentOrderV2CountId entries...")
    countid_count = 0

    countid_entities = []
    for afcq_id, af_id, _ in v2_records:
        try:
            numeric = int(afcq_id[5:])
        except ValueError:
            continue
        cid_key = client.key("ShipmentOrderV2CountId", af_id)
        cid_entity = datastore.Entity(key=cid_key)
        cid_entity.update({
            "countid": numeric,
            "created": migration_ts,
            "migrated_from_v1": True,
        })
        countid_entities.append(cid_entity)
        countid_count += 1

    print(f"  ShipmentOrderV2CountId entries: {countid_count}")

    # ===================================================================
    # Step 7 — Write all entities (live mode only)
    # ===================================================================
    written_quotations = 0
    written_wf = 0
    written_files = 0
    written_countid = 0

    if not dry_run and v2_records:
        print(f"\nStep 7: Writing entities...")

        # Write Quotation entities
        print(f"  Writing {len(v2_records)} Quotation entities...")
        for i in range(0, len(v2_records), WRITE_CHUNK_SIZE):
            chunk = v2_records[i:i + WRITE_CHUNK_SIZE]
            entities = []
            for afcq_id, af_id, record in chunk:
                key = client.key("Quotation", af_id)
                entity = datastore.Entity(key=key)
                entity.update(record)
                entity.exclude_from_indexes = {
                    "status_history", "parties", "booking", "bl_document",
                    "files", "origin", "destination", "cargo",
                }
                entities.append(entity)
            client.put_multi(entities)
            written_quotations += len(entities)
            print(f"    Written {written_quotations}/{len(v2_records)}")

        # Write ShipmentWorkFlow entities
        if wf_new_entities:
            print(f"  Writing {len(wf_new_entities)} ShipmentWorkFlow entities...")
            for i in range(0, len(wf_new_entities), WRITE_CHUNK_SIZE):
                chunk = wf_new_entities[i:i + WRITE_CHUNK_SIZE]
                client.put_multi(chunk)
                written_wf += len(chunk)

        # Write Files updates
        if file_entities_to_update:
            print(f"  Writing {len(file_entities_to_update)} Files updates...")
            for i in range(0, len(file_entities_to_update), WRITE_CHUNK_SIZE):
                chunk = file_entities_to_update[i:i + WRITE_CHUNK_SIZE]
                client.put_multi(chunk)
                written_files += len(chunk)

        # Write ShipmentOrderV2CountId entries
        if countid_entities:
            print(f"  Writing {len(countid_entities)} ShipmentOrderV2CountId entries...")
            for i in range(0, len(countid_entities), WRITE_CHUNK_SIZE):
                chunk = countid_entities[i:i + WRITE_CHUNK_SIZE]
                client.put_multi(chunk)
                written_countid += len(chunk)
    elif dry_run:
        print("\nStep 7: Skipped writes (dry run)")
    else:
        print("\nStep 7: No records to write")

    # ===================================================================
    # Report
    # ===================================================================
    _print_report(
        mode=mode,
        total=len(afcq_ids),
        skipped_already=skipped_already,
        assembled=assembly_count,
        error_count=len(errors),
        type_counts=dict(type_counts),
        status_counts=dict(status_counts),
        active_orders=active_orders,
        errors=errors,
        wf_rekeyed=wf_rekey_count,
        files_updated=files_updated_count,
        countid_registered=countid_count,
        written=written_quotations,
    )


def _print_report(
    mode: str,
    total: int,
    skipped_already: int,
    assembled: int,
    error_count: int,
    type_counts: dict,
    status_counts: dict,
    active_orders: list,
    errors: list,
    wf_rekeyed: int,
    files_updated: int,
    countid_registered: int,
    written: int,
):
    """Print the structured migration report."""
    print("\n" + "=" * 55)
    print("=== V1->V2 Migration Report ===")
    print(f"Mode: {mode}")
    print(f"Total AFCQ- records found:        {total}")
    print(f"  Already migrated (skipped):     {skipped_already}")
    print(f"  Assembly errors:                {error_count}")
    print(f"  Successfully assembled:         {assembled}")
    print()
    print("Order type breakdown:")
    for ot in [ORDER_TYPE_SEA_FCL, ORDER_TYPE_SEA_LCL, ORDER_TYPE_AIR]:
        label = ot.ljust(10)
        print(f"  {label} {type_counts.get(ot, 0)}")
    unknown = sum(v for k, v in type_counts.items() if k not in (ORDER_TYPE_SEA_FCL, ORDER_TYPE_SEA_LCL, ORDER_TYPE_AIR))
    if unknown:
        print(f"  {'Unknown'.ljust(10)} {unknown}")
    print()
    print("Status breakdown (V2 codes):")
    for code in sorted(status_counts.keys()):
        label = STATUS_LABELS.get(code, "Unknown")
        print(f"  {code} {label}:{' ' * max(1, 22 - len(label) - len(str(code)))} {status_counts[code]}")
    print()
    print("Active records migrated (status != 5001 and != -1):")
    if active_orders:
        for afcq_id, af_id, st in active_orders:
            label = STATUS_LABELS.get(st, "Unknown")
            print(f"  {afcq_id} -> {af_id}  ({st} {label})")
    else:
        print("  (none)")
    print()
    print(f"ShipmentWorkFlow re-keyed:        {wf_rekeyed}")
    print(f"Files updated:                    {files_updated}")
    print(f"ShipmentOrderV2CountId registered: {countid_registered}")
    print()
    print(f"Records written: {written} (0 in dry run)" if mode == "DRY RUN" else f"Records written: {written}")
    print()
    if errors:
        print("Assembly errors:")
        for afcq_id, reason in errors:
            print(f"  {afcq_id}: {reason}")
    print("=" * 55)


if __name__ == "__main__":
    main()
