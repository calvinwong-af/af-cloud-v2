"""
scripts/migrate_v1_to_v2.py

V1 -> V2 Migration Script — One-time cutover migration.

Reads all V1 Quotation records and their associated sub-Kind entities,
assembles them into a single V2 ShipmentOrder entity per record, and writes
them to Datastore. Old records are never modified or deleted.

Dry run (default — safe, no writes):
  python scripts/migrate_v1_to_v2.py

Live run:
  DRY_RUN=false python scripts/migrate_v1_to_v2.py

With service account key (local):
  GOOGLE_APPLICATION_CREDENTIALS=./cloud-accele-freight-b7a0a3b8fd98.json \
  DRY_RUN=false python scripts/migrate_v1_to_v2.py
"""

import logging
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# Ensure af-server root is on sys.path so core.* imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google.cloud import datastore

from core.constants import (
    ORDER_TYPE_AIR,
    ORDER_TYPE_SEA_FCL,
    ORDER_TYPE_SEA_LCL,
    PREFIX_V1_SHIPMENT,
    PROJECT_ID,
    STATUS_BOOKED,
    STATUS_COMPLETED,
    STATUS_CONFIRMED,
    STATUS_DRAFT,
    STATUS_LABELS,
    V1_TO_V2_STATUS,
)
from core.datastore import entity_to_dict, get_multi_chunked, parse_timestamp

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DRY_RUN = os.environ.get("DRY_RUN", "true").lower() != "false"
WRITE_CHUNK_SIZE = 500

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Order type mapping
# ---------------------------------------------------------------------------
def derive_order_type(quotation_freight: dict) -> str:
    """Derive V2 order_type from V1 QuotationFreight fields.

    V1 uses:
      - freight_type: "SEA" | "AIR"
      - container_load: "FCL" | "LCL"
    The prompt's quotation_type/quotation_category do not exist — actual
    field names discovered from live Datastore inspection.
    """
    freight_type = (quotation_freight.get("freight_type") or "").upper()
    container_load = (quotation_freight.get("container_load") or "").upper()

    if freight_type == "AIR":
        return ORDER_TYPE_AIR
    elif container_load == "FCL":
        return ORDER_TYPE_SEA_FCL
    elif container_load == "LCL":
        return ORDER_TYPE_SEA_LCL
    else:
        log.warning(
            "Unknown order type: freight_type=%r, container_load=%r -- defaulting to SEA_LCL",
            freight_type, container_load,
        )
        return ORDER_TYPE_SEA_LCL


# ---------------------------------------------------------------------------
# Status mapping
# ---------------------------------------------------------------------------
def derive_status(quotation: dict, shipment_order: dict | None) -> int:
    """Map V1 status to V2 status code."""
    if shipment_order:
        v1_status = shipment_order.get("status", 1)
        if v1_status in V1_TO_V2_STATUS:
            return V1_TO_V2_STATUS[v1_status]
        # Any status >= 110 and < 10000 that isn't in the map -> Booked
        if 110 <= v1_status < 10000:
            return STATUS_BOOKED
        return STATUS_CONFIRMED  # fallback

    # No ShipmentOrder — derive from Quotation fields
    if quotation.get("quotation_closed") or quotation.get("status") == 5001:
        return STATUS_COMPLETED
    if quotation.get("confirmed"):
        return STATUS_CONFIRMED
    if quotation.get("draft") or quotation.get("status") == 1001:
        return STATUS_DRAFT
    log.warning("Could not derive status for %s — defaulting to DRAFT", quotation.get("id"))
    return STATUS_DRAFT


# ---------------------------------------------------------------------------
# Party assembly
# ---------------------------------------------------------------------------
def _build_party(shipment_order: dict | None, field_name: str) -> dict:
    """Extract a party (shipper/consignee/notify_party) from ShipmentOrder.

    V1 stores parties as nested entities on ShipmentOrder:
      shipper: {company_contact_name, address: {line_1, city, ...}, contact_info: {email, phone, ...}}
      consignee: same structure
      notify_party: same structure
    """
    if not shipment_order:
        return {"name": None, "address": None, "contact": None}

    party = shipment_order.get(field_name)
    if not party or not isinstance(party, dict):
        return {"name": None, "address": None, "contact": None}

    # Name
    name = party.get("company_contact_name") or party.get("tag") or None

    # Address — flatten the nested address entity
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

    # Contact — flatten the contact_info entity
    contact_entity = party.get("contact_info")
    contact = None
    if contact_entity and isinstance(contact_entity, dict):
        parts = [
            contact_entity.get("first_name"),
            contact_entity.get("last_name"),
            contact_entity.get("email"),
            contact_entity.get("phone"),
        ]
        contact_str = ", ".join(p for p in parts if p)
        contact = contact_str or None

    return {"name": name, "address": address, "contact": contact}


# ---------------------------------------------------------------------------
# Type details assembly
# ---------------------------------------------------------------------------
def _build_type_details_fcl(q_fcl: dict | None, so_fcl: dict | None, q_freight: dict) -> dict:
    """Build type_details for FCL shipments.

    V1 QuotationFCL.containers: [{container_size: "20", container_type: "DRY", container_quantity: 1}]
    Also has top-level container_size, container_type, container_total for the primary container.
    """
    source = q_fcl or {}
    containers_raw = source.get("containers") or []
    containers = []
    for c in containers_raw:
        if isinstance(c, dict):
            # V1 uses container_size ("20", "40") + container_type ("DRY", "REEFER")
            # Combine into V2 format like "20GP", "40HC"
            size = str(c.get("container_size") or "")
            ctype = str(c.get("container_type") or "")
            container_label = f"{size}{ctype}" if size else ctype
            containers.append({
                "container_type": container_label,
                "quantity": int(c.get("container_quantity") or c.get("quantity") or 0),
            })
    # Fallback: use top-level fields if containers list was empty
    if not containers and source.get("container_size"):
        containers.append({
            "container_type": f"{source.get('container_size', '')}{source.get('container_type', '')}",
            "quantity": int(source.get("container_total") or source.get("container_quantity") or 0),
        })
    return {
        "containers": containers,
        "packages": [],
        "include_other_services": bool(q_freight.get("include_other_services", False)),
        "other_services": q_freight.get("other_services") or None,
    }


def _build_cargo_units(source: dict | None) -> list:
    """Build packages list from V1 cargo_units array.

    V1 cargo_units: [{quantity, total_weight, total_cubic_meters, type, ...}]
    """
    if not source:
        return []
    cargo_units = source.get("cargo_units") or []
    packages = []
    for u in cargo_units:
        if isinstance(u, dict):
            packages.append({
                "quantity": int(u.get("quantity") or 0),
                "weight_kg": float(u.get("total_weight") or u.get("weight") or 0),
                "cbm": float(u.get("total_cubic_meters") or u.get("cbm") or 0),
            })
    return packages


def _build_type_details_lcl(q_lcl: dict | None, so_lcl: dict | None, q_freight: dict) -> dict:
    """Build type_details for LCL shipments."""
    # QuotationLCL has the cargo_units; ShipmentOrderLCL only has transport info
    packages = _build_cargo_units(q_lcl)
    return {
        "containers": [],
        "packages": packages,
        "include_other_services": bool(q_freight.get("include_other_services", False)),
        "other_services": q_freight.get("other_services") or None,
    }


def _build_type_details_air(q_air: dict | None, so_air: dict | None, q_freight: dict) -> dict:
    """Build type_details for AIR shipments."""
    # QuotationAir has the cargo_units; ShipmentOrderAir only has transport info
    packages = _build_cargo_units(q_air)
    return {
        "containers": [],
        "packages": packages,
        "include_other_services": bool(q_freight.get("include_other_services", False)),
        "other_services": q_freight.get("other_services") or None,
    }


def _safe_date_str(value) -> str | None:
    """Convert a date/datetime value to ISO string, handling V1 mixed types."""
    if not value:
        return None
    if isinstance(value, str):
        return value
    dt = parse_timestamp(value)
    return dt.isoformat() if dt else str(value)


def _is_dangerous_goods(q_freight: dict) -> bool:
    """Check if V1 QuotationFreight indicates dangerous goods.

    V1 stores cargo_type as a nested entity: {code: "DG" | "NON-DG", label: ...}
    """
    cargo_type = q_freight.get("cargo_type")
    if cargo_type and isinstance(cargo_type, dict):
        return (cargo_type.get("code") or "").upper() == "DG"
    return False


# ---------------------------------------------------------------------------
# Record assembly
# ---------------------------------------------------------------------------
def assemble_v2_record(
    quotation: dict,
    q_freight: dict | None,
    shipment_order: dict | None,
    q_fcl: dict | None,
    q_lcl: dict | None,
    q_air: dict | None,
    so_fcl: dict | None,
    so_lcl: dict | None,
    so_air: dict | None,
    migration_ts: str,
) -> dict:
    """Assemble one V2 ShipmentOrder record from V1 source Kinds."""
    q_freight = q_freight or {}

    # Order type
    order_type = derive_order_type(q_freight)

    # Port type
    port_type = "AIR" if order_type == ORDER_TYPE_AIR else "SEA"

    # Location — prefer ShipmentOrder, fall back to Quotation
    origin_code = None
    dest_code = None
    if shipment_order:
        origin_code = shipment_order.get("origin_port_un_code") or None
        dest_code = shipment_order.get("destination_port_un_code") or None
    if not origin_code:
        origin_code = quotation.get("origin_port_un_code") or None
    if not dest_code:
        dest_code = quotation.get("destination_port_un_code") or None

    # Status
    status = derive_status(quotation, shipment_order)

    # Type details
    if order_type == ORDER_TYPE_SEA_FCL:
        type_details = _build_type_details_fcl(q_fcl, so_fcl, q_freight)
    elif order_type == ORDER_TYPE_AIR:
        type_details = _build_type_details_air(q_air, so_air, q_freight)
    else:
        type_details = _build_type_details_lcl(q_lcl, so_lcl, q_freight)

    # Parties — stored as nested entities on ShipmentOrder (old Kind)
    parties = {
        "shipper": _build_party(shipment_order, "shipper"),
        "consignee": _build_party(shipment_order, "consignee"),
        "notify_party": _build_party(shipment_order, "notify_party"),
    }

    # Booking — V1 stores booking info in booking_info nested entity
    so = shipment_order or {}
    booking_info = so.get("booking_info") or {}
    if isinstance(booking_info, dict):
        booking_ref = booking_info.get("booking_reference") or None
        carrier = booking_info.get("container_operator") or None
    else:
        booking_ref = None
        carrier = None
    booking = {
        "bl_number": so.get("bl_number") or booking_ref,
        "vessel_name": so.get("vessel_name") or None,
        "voyage_number": so.get("voyage_number") or None,
        "carrier": so.get("carrier") or carrier,
        "flight_number": so.get("flight_number") or None,
        "awb_number": so.get("awb_number") or None,
    }

    # Dates
    etd = so.get("etd") or None
    eta = so.get("eta") or None

    # Created timestamp — parse and re-write as ISO UTC
    created_raw = quotation.get("created")
    created_dt = parse_timestamp(created_raw)
    created_iso = created_dt.isoformat() if created_dt else None

    # Company — prefer ShipmentOrder, fall back to Quotation
    company_id = None
    if shipment_order:
        company_id = shipment_order.get("company_id") or None
    if not company_id:
        company_id = quotation.get("company_id") or ""

    return {
        # Identity
        "quotation_id": quotation.get("id"),
        "data_version": 2,
        "migrated_from_v1": True,
        "migration_timestamp": migration_ts,
        # Classification
        "order_type": order_type,
        "transaction_type": (quotation.get("transaction_type") or "").upper() or None,
        # Status
        "status": status,
        # Location
        "origin": {
            "port_un_code": origin_code,
            "type": port_type,
        },
        "destination": {
            "port_un_code": dest_code,
            "type": port_type,
        },
        # Cargo — V1 uses commodity (not cargo_description),
        # cargo_type.code == "DG" for dangerous goods
        "cargo": {
            "description": q_freight.get("commodity") or "",
            "hs_code": q_freight.get("hs_code") or None,
            "is_dg": _is_dangerous_goods(q_freight),
            "dg_class": q_freight.get("dg_class") or None,
        },
        # Type details
        "type_details": type_details,
        # Parties
        "parties": parties,
        # Booking
        "booking": booking,
        # Dates
        "cargo_ready_date": _safe_date_str(quotation.get("cargo_ready_date")),
        "etd": _safe_date_str(etd),
        "eta": _safe_date_str(eta),
        # References
        "company_id": company_id,
        "incoterm": quotation.get("incoterm_code") or None,
        "commercial_quotation_ids": [],
        "files": [],
        "customs_clearance": [],
        # Soft delete
        "trash": bool(quotation.get("trash", False)),
        # Audit
        "creator": quotation.get("creator") or None,
        "user": quotation.get("user") or None,
        "created": created_iso,
        "updated": migration_ts,
    }


# ---------------------------------------------------------------------------
# Batch fetch helpers
# ---------------------------------------------------------------------------
def _build_lookup(entities: list, key_attr: str = "key_name") -> dict:
    """Build a dict keyed by entity key name from a list of entities."""
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


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
def print_report(
    mode: str,
    total: int,
    skipped_v2: int,
    skipped_drafts: int,
    with_so: int,
    without_so: int,
    type_counts: dict,
    status_counts: dict,
    active_orders: list,
    errors: list,
    written: int,
):
    """Print the structured migration report."""
    print("\n" + "=" * 50)
    print(f"=== V1 -> V2 Migration Report ===")
    print(f"Mode: {mode}")
    print()
    print(f"Total V1 Quotation records:     {total}")
    print(f"  Skipped (already V2):         {skipped_v2}")
    print(f"  Skipped (legacy drafts):      {skipped_drafts}")
    print(f"  With ShipmentOrder:           {with_so}")
    print(f"  Without ShipmentOrder:        {without_so}")
    print()
    print("Order type breakdown:")
    for ot in [ORDER_TYPE_SEA_FCL, ORDER_TYPE_SEA_LCL, ORDER_TYPE_AIR]:
        print(f"  {ot}:{'  ' if ot == ORDER_TYPE_AIR else ' '} {type_counts.get(ot, 0)}")
    unknown = sum(v for k, v in type_counts.items() if k not in [ORDER_TYPE_SEA_FCL, ORDER_TYPE_SEA_LCL, ORDER_TYPE_AIR])
    print(f"  Unknown:   {unknown}")
    print()
    print("Status breakdown (V2):")
    for code in sorted(status_counts.keys()):
        label = STATUS_LABELS.get(code, "Unknown")
        print(f"  {code} {label}:{' ' * max(1, 22 - len(label) - len(str(code)))} {status_counts[code]}")
    print()
    print(f"Active orders (status < 5001 and != -1):")
    if active_orders:
        for qid, st in active_orders:
            label = STATUS_LABELS.get(st, "Unknown")
            print(f"  {qid} -> {st} ({label})")
    else:
        print("  (none)")
    print()
    print("Assembly errors:")
    if errors:
        for qid, reason in errors:
            print(f"  {qid}: {reason}")
    else:
        print("  (none)")
    print()
    if not DRY_RUN:
        print(f"Records written: {written}")
    print("=" * 50)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    mode = "DRY RUN" if DRY_RUN else "LIVE"
    print(f"=== V1 -> V2 Migration — {mode} MODE ===\n")

    if not DRY_RUN:
        confirm = input("Running in LIVE mode. Type 'yes' to continue: ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            sys.exit(0)

    client = datastore.Client(project=PROJECT_ID)
    migration_ts = datetime.now(timezone.utc).isoformat()

    # -----------------------------------------------------------------------
    # Step 1: Fetch all V1 Quotation records
    # -----------------------------------------------------------------------
    print("Fetching all Quotation records...")
    query = client.query(kind="Quotation")
    all_quotations_raw = list(query.fetch())
    print(f"  Found {len(all_quotations_raw)} total Quotation records")

    # Filter to V1 only (skip data_version == 2)
    v1_quotations = []
    skipped_v2 = 0
    for entity in all_quotations_raw:
        if entity.get("data_version") == 2:
            skipped_v2 += 1
            continue
        v1_quotations.append(entity)

    print(f"  V1 records: {len(v1_quotations)} (skipped {skipped_v2} V2 records)")

    if not v1_quotations:
        print("No V1 records to migrate.")
        return

    # Collect all AFCQ key names
    afcq_ids = []
    quotation_lookup = {}
    for entity in v1_quotations:
        key_name = entity.key.name or str(entity.key.id)
        afcq_ids.append(key_name)
        quotation_lookup[key_name] = entity_to_dict(entity)

    # -----------------------------------------------------------------------
    # Step 2: Batch-fetch all related Kinds
    # -----------------------------------------------------------------------
    print("Batch-fetching related Kinds...")

    freight_lookup = _fetch_kind_by_keys(client, "QuotationFreight", afcq_ids)
    print(f"  QuotationFreight: {len(freight_lookup)}")

    so_lookup = _fetch_kind_by_keys(client, "ShipmentOrder", afcq_ids)
    print(f"  ShipmentOrder (old): {len(so_lookup)}")

    q_fcl_lookup = _fetch_kind_by_keys(client, "QuotationFCL", afcq_ids)
    print(f"  QuotationFCL: {len(q_fcl_lookup)}")

    q_lcl_lookup = _fetch_kind_by_keys(client, "QuotationLCL", afcq_ids)
    print(f"  QuotationLCL: {len(q_lcl_lookup)}")

    q_air_lookup = _fetch_kind_by_keys(client, "QuotationAir", afcq_ids)
    print(f"  QuotationAir: {len(q_air_lookup)}")

    so_fcl_lookup = _fetch_kind_by_keys(client, "ShipmentOrderFCL", afcq_ids)
    print(f"  ShipmentOrderFCL: {len(so_fcl_lookup)}")

    so_lcl_lookup = _fetch_kind_by_keys(client, "ShipmentOrderLCL", afcq_ids)
    print(f"  ShipmentOrderLCL: {len(so_lcl_lookup)}")

    so_air_lookup = _fetch_kind_by_keys(client, "ShipmentOrderAir", afcq_ids)
    print(f"  ShipmentOrderAir: {len(so_air_lookup)}")

    # -----------------------------------------------------------------------
    # Step 3: Assemble V2 records
    # -----------------------------------------------------------------------
    print("\nAssembling V2 records...")
    v2_records = []
    errors = []
    type_counts = defaultdict(int)
    status_counts = defaultdict(int)
    active_orders = []
    with_so = 0
    without_so = 0
    skipped_drafts = 0

    for afcq_id in afcq_ids:
        quotation = quotation_lookup[afcq_id]
        q_freight = freight_lookup.get(afcq_id)
        shipment_order = so_lookup.get(afcq_id)

        # Skip legacy drafts: no ShipmentOrder OR would-be-draft status
        if not shipment_order or derive_status(quotation, shipment_order) == STATUS_DRAFT:
            skipped_drafts += 1
            continue

        with_so += 1

        try:
            record = assemble_v2_record(
                quotation=quotation,
                q_freight=q_freight,
                shipment_order=shipment_order,
                q_fcl=q_fcl_lookup.get(afcq_id),
                q_lcl=q_lcl_lookup.get(afcq_id),
                q_air=q_air_lookup.get(afcq_id),
                so_fcl=so_fcl_lookup.get(afcq_id),
                so_lcl=so_lcl_lookup.get(afcq_id),
                so_air=so_air_lookup.get(afcq_id),
                migration_ts=migration_ts,
            )
            v2_records.append((afcq_id, record))

            # Collect stats
            type_counts[record["order_type"]] += 1
            status_counts[record["status"]] += 1

            # Track active orders for review
            st = record["status"]
            if st != -1 and st < 5001:
                active_orders.append((afcq_id, st))

        except Exception as e:
            errors.append((afcq_id, str(e)))
            log.error("Failed to assemble %s: %s", afcq_id, e)

    print(f"  Assembled: {len(v2_records)}, Skipped (legacy drafts): {skipped_drafts}, Errors: {len(errors)}")

    # -----------------------------------------------------------------------
    # Step 4: Write (live mode only)
    # -----------------------------------------------------------------------
    written = 0
    if not DRY_RUN and v2_records:
        print(f"\nWriting {len(v2_records)} records in chunks of {WRITE_CHUNK_SIZE}...")
        for i in range(0, len(v2_records), WRITE_CHUNK_SIZE):
            chunk = v2_records[i : i + WRITE_CHUNK_SIZE]
            entities = []
            for afcq_id, record in chunk:
                key = client.key("ShipmentOrder", afcq_id)
                entity = datastore.Entity(key=key)
                entity.update(record)
                entities.append(entity)
            client.put_multi(entities)
            written += len(entities)
            print(f"  Written {written}/{len(v2_records)}")

    # -----------------------------------------------------------------------
    # Step 5: Report
    # -----------------------------------------------------------------------
    print_report(
        mode=mode,
        total=len(all_quotations_raw),
        skipped_v2=skipped_v2,
        skipped_drafts=skipped_drafts,
        with_so=with_so,
        without_so=without_so,
        type_counts=dict(type_counts),
        status_counts=dict(status_counts),
        active_orders=active_orders,
        errors=errors,
        written=written,
    )


if __name__ == "__main__":
    main()
