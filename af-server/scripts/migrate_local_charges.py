"""
scripts/migrate_local_charges.py

Migrate local charges data from Google Cloud Datastore to PostgreSQL.

Reads:
  - PricingLocalCharges — charge line item definitions
  - PTMonthlyRatePortCharges — monthly rate history (kind=PT-LOCAL-CHARGES)

Usage (from project root C:\\dev\\af-cloud-v2):
    af-server\\.venv\\Scripts\\python.exe af-server/scripts/migrate_local_charges.py
"""

import calendar
import os
import sys
from collections import defaultdict
from datetime import date, datetime, timezone

from google.cloud import datastore as ds
from sqlalchemy import create_engine, text

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DRY_RUN = True  # Set to False to execute real inserts

DATASTORE_PROJECT = "cloud-accele-freight"
SERVICE_ACCOUNT_KEY = "claude/legacy-reference/af-team-af-cloud-webserver-2999c133ea36/cloud-accele-freight-b7a0a3b8fd98.json"

# PostgreSQL — Cloud SQL Auth Proxy must be running on localhost:5432
PG_DSN = "postgresql+psycopg2://af_server:Afserver_2019@localhost:5432/accelefreight"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

VALID_UOMS = {"CONTAINER", "CBM", "KG", "W/M", "CW_KG", "SET", "BL", "QTL", "RAIL_3KG"}

# Legacy UOM codes remapped to valid new UOMs
UOM_REMAP = {
    "CTR": "CONTAINER",    # legacy name for container unit
    "RT": "W/M",           # revenue tonne → W/M (business decision)
    "CW": "CW_KG",         # chargeable weight → CW_KG
    "C3KG": "RAIL_3KG",    # rail volumetric (1:3 ratio) → RAIL_3KG
}

# Legacy port codes remapped to valid new port codes
PORT_CODE_REMAP = {
    "MYPKG_N": "MYPKG",    # NorthPort Penang — remapped to MYPKG
}

# Legacy container type codes remapped to valid new container types
CONTAINER_TYPE_REMAP = {
    "DRY": "GP",            # dry container → General Purpose
    "REEFER": "RF",         # reefer → Reefer
}

VALID_CONTAINER_TYPES = {"GP", "HC", "RF", "FF", "OT", "FR", "PL", "ALL"}
VALID_CONTAINER_SIZES = {"20", "40", "ALL"}

MONTH_MAP = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_month_year(my: str):
    """Parse 'MAR-2024' → (date(2024,3,1), date(2024,3,31))."""
    parts = my.strip().split("-")
    if len(parts) != 2:
        return None, None
    month_str, year_str = parts
    month = MONTH_MAP.get(month_str.upper())
    if not month:
        return None, None
    try:
        year = int(year_str)
    except ValueError:
        return None, None
    first = date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    last = date(year, month, last_day)
    return first, last


def wildcard_to_all(val):
    """Convert legacy '*' wildcard to 'ALL'."""
    if val == "*" or val is None:
        return "ALL"
    return str(val).strip().upper()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Connect to Datastore
    key_path = os.path.join(os.getcwd(), SERVICE_ACCOUNT_KEY)
    if not os.path.exists(key_path):
        print(f"ERROR: Service account key not found at {key_path}")
        print("Run this script from the project root: C:\\dev\\af-cloud-v2")
        sys.exit(1)

    client = ds.Client(project=DATASTORE_PROJECT)
    client._credentials = None  # reset — will re-auth from key file
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = key_path
    client = ds.Client(project=DATASTORE_PROJECT)

    engine = create_engine(PG_DSN)

    # Fetch valid port codes from PostgreSQL
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT un_code FROM ports")).fetchall()
        valid_ports = {r[0] for r in rows}

    print(f"Loaded {len(valid_ports)} valid port codes from PostgreSQL.")

    # -----------------------------------------------------------------------
    # Step 1: Fetch PricingLocalCharges
    # -----------------------------------------------------------------------
    print("\nFetching PricingLocalCharges from Datastore...")
    query = client.query(kind="PricingLocalCharges")
    items_raw = list(query.fetch())
    print(f"  Fetched {len(items_raw)} PricingLocalCharges entities.")

    # Build lookup: pt_id → item dict
    items = {}
    skipped_ports = []
    remapped_ports = []
    container_type_remapped_count = 0
    for e in items_raw:
        pt_id = e.get("pt_id")
        if pt_id is None:
            continue
        port_code = str(e.get("port_un_code", "")).strip().upper()

        # Apply port code remapping before validation
        if port_code in PORT_CODE_REMAP:
            remapped_to = PORT_CODE_REMAP[port_code]
            remapped_ports.append({"pt_id": pt_id, "from": port_code, "to": remapped_to})
            port_code = remapped_to

        if not port_code or port_code not in valid_ports:
            skipped_ports.append({"pt_id": pt_id, "port_un_code": port_code})
            continue

        # Apply container type remapping
        container_type = wildcard_to_all(e.get("container_type"))
        if container_type in CONTAINER_TYPE_REMAP:
            container_type = CONTAINER_TYPE_REMAP[container_type]
            container_type_remapped_count += 1

        items[pt_id] = {
            "port_code": port_code,
            "trade_direction": str(e.get("transaction_type", "")).strip().upper(),
            "shipment_type": wildcard_to_all(e.get("container_load")),
            "container_size": wildcard_to_all(e.get("container_size")),
            "container_type": container_type,
            "charge_code": str(e.get("code", "")).strip(),
            "description": str(e.get("description", "")).strip(),
            "is_domestic": bool(e.get("is_domestic", False)),
            "is_active": not bool(e.get("trash", False)),
        }

    print(f"  Valid items: {len(items)}")
    if remapped_ports:
        print(f"  Remapped (port code substitution): {len(remapped_ports)}")
        for rp in remapped_ports[:10]:
            print(f"    pt_id={rp['pt_id']} {rp['from']} → {rp['to']}")
        if len(remapped_ports) > 10:
            print(f"    ... and {len(remapped_ports) - 10} more")
    if container_type_remapped_count:
        print(f"  Remapped (container type substitution): {container_type_remapped_count} items (DRY→GP, REEFER→RF)")
    if skipped_ports:
        print(f"  Skipped (port not in ports table): {len(skipped_ports)}")
        for sp in skipped_ports[:10]:
            print(f"    pt_id={sp['pt_id']} port_un_code={sp['port_un_code']}")
        if len(skipped_ports) > 10:
            print(f"    ... and {len(skipped_ports) - 10} more")

    # -----------------------------------------------------------------------
    # Step 2: Fetch PTMonthlyRatePortCharges (kind=PT-LOCAL-CHARGES)
    # -----------------------------------------------------------------------
    print("\nFetching PTMonthlyRatePortCharges from Datastore...")
    query = client.query(kind="PTMonthlyRatePortCharges")
    query.add_filter("kind", "=", "PT-LOCAL-CHARGES")
    rates_raw = list(query.fetch())
    print(f"  Fetched {len(rates_raw)} rate entries (kind=PT-LOCAL-CHARGES).")

    # -----------------------------------------------------------------------
    # Step 3: Transform
    # -----------------------------------------------------------------------
    rows_to_insert = []
    skipped_no_item = 0
    skipped_uom = []
    skipped_month = 0
    skipped_direction = 0
    skipped_container_size_map = defaultdict(int)
    skipped_container_type_map = defaultdict(int)
    uom_remapped_count = 0

    now = datetime.now(timezone.utc).isoformat()

    for rate in rates_raw:
        pt_id = rate.get("pt_id")
        if pt_id not in items:
            skipped_no_item += 1
            continue

        item = items[pt_id]

        # Parse month_year
        month_year = str(rate.get("month_year", "")).strip()
        eff_from, eff_to = parse_month_year(month_year)
        if eff_from is None:
            skipped_month += 1
            continue

        # UOM — apply remap first, then validate
        uom = str(rate.get("uom", "")).strip().upper()
        if uom in UOM_REMAP:
            uom = UOM_REMAP[uom]
            uom_remapped_count += 1
        if uom not in VALID_UOMS:
            skipped_uom.append({"pt_id": pt_id, "month_year": month_year, "uom": uom})
            continue

        # Validate trade_direction
        if item["trade_direction"] not in ("IMPORT", "EXPORT"):
            skipped_direction += 1
            continue

        # Validate container_size
        if item["container_size"] not in VALID_CONTAINER_SIZES:
            skipped_container_size_map[item["container_size"]] += 1
            continue

        # Validate container_type
        if item["container_type"] not in VALID_CONTAINER_TYPES:
            skipped_container_type_map[item["container_type"]] += 1
            continue

        # Extract price and cost
        price_dict = rate.get("price")
        price_val = 0.0
        if isinstance(price_dict, dict):
            price_val = float(price_dict.get("price", 0) or 0)
        elif isinstance(price_dict, (int, float)):
            price_val = float(price_dict)

        cost_dict = rate.get("cost")
        cost_val = 0.0
        if isinstance(cost_dict, dict):
            cost_val = float(cost_dict.get("cost", 0) or 0)
        elif isinstance(cost_dict, (int, float)):
            cost_val = float(cost_dict)

        currency = str(rate.get("currency", "MYR") or "MYR").strip().upper()

        # Extract paid_with_freight
        conditions = rate.get("conditions")
        paid_with_freight = False
        if isinstance(conditions, dict):
            paid_with_freight = bool(conditions.get("paid_with_freight", False))

        rows_to_insert.append({
            "port_code": item["port_code"],
            "trade_direction": item["trade_direction"],
            "shipment_type": item["shipment_type"],
            "container_size": item["container_size"],
            "container_type": item["container_type"],
            "charge_code": item["charge_code"],
            "description": item["description"],
            "price": price_val,
            "cost": cost_val,
            "currency": currency,
            "uom": uom,
            "is_domestic": item["is_domestic"],
            "paid_with_freight": paid_with_freight,
            "effective_from": str(eff_from),
            "effective_to": str(eff_to),
            "is_active": item["is_active"],
            "created_at": now,
            "updated_at": now,
        })

    skipped_container_size_total = sum(skipped_container_size_map.values())
    skipped_container_type_total = sum(skipped_container_type_map.values())

    print(f"\nTransformation complete:")
    print(f"  Rows ready to insert: {len(rows_to_insert)}")
    print(f"  UOM remapped (CTR→CONTAINER, RT→W/M, CW→CW_KG, C3KG→RAIL_3KG): {uom_remapped_count}")
    print(f"  Skipped (no matching item / port invalid): {skipped_no_item}")
    print(f"  Skipped (invalid UOM): {len(skipped_uom)}")
    print(f"  Skipped (invalid month_year): {skipped_month}")
    print(f"  Skipped (invalid trade_direction): {skipped_direction}")
    print(f"  Skipped (invalid container_size): {skipped_container_size_total}")
    if skipped_container_size_map:
        print(f"    Distinct invalid container_size values:")
        for val, cnt in sorted(skipped_container_size_map.items()):
            print(f"      '{val}' → {cnt} rows")
    print(f"  Skipped (invalid container_type): {skipped_container_type_total}")
    if skipped_container_type_map:
        print(f"    Distinct invalid container_type values:")
        for val, cnt in sorted(skipped_container_type_map.items()):
            print(f"      '{val}' → {cnt} rows")

    if skipped_uom:
        print(f"\n  Remaining invalid UOM details (first 20):")
        for s in skipped_uom[:20]:
            print(f"    pt_id={s['pt_id']} month_year={s['month_year']} uom={s['uom']}")

    # -----------------------------------------------------------------------
    # Step 4: Insert or print
    # -----------------------------------------------------------------------
    if DRY_RUN:
        print(f"\n[DRY RUN] Would insert {len(rows_to_insert)} rows into local_charges.\n")
        if rows_to_insert:
            print(f"Sample (first 20 rows):")
            print(f"  {'PORT':<8} {'DIR':<8} {'STYPE':<6} {'CSIZE':<6} {'CTYPE':<6} {'CODE':<12} {'UOM':<10} {'PRICE':>10} {'COST':>10} {'EFF_FROM':<12} {'EFF_TO':<12} {'ACTIVE':<7} {'DOM':<6} {'PWF':<5}")
            for r in rows_to_insert[:20]:
                print(f"  {r['port_code']:<8} {r['trade_direction']:<8} {r['shipment_type']:<6} {r['container_size']:<6} {r['container_type']:<6} {r['charge_code']:<12} {r['uom']:<10} {r['price']:>10.2f} {r['cost']:>10.2f} {r['effective_from']:<12} {r['effective_to']:<12} {str(r['is_active']):<7} {str(r['is_domestic']):<6} {str(r['paid_with_freight']):<5}")
            if len(rows_to_insert) > 20:
                print(f"  ... and {len(rows_to_insert) - 20} more rows")
    else:
        print(f"\n[LIVE] Inserting {len(rows_to_insert)} rows into local_charges...")
        inserted = 0
        skipped_conflict = 0

        insert_sql = text("""
            INSERT INTO local_charges (
                port_code, trade_direction, shipment_type,
                container_size, container_type,
                charge_code, description, price, cost, currency, uom,
                is_domestic, paid_with_freight,
                effective_from, effective_to, is_active,
                created_at, updated_at
            )
            VALUES (
                :port_code, :trade_direction, :shipment_type,
                :container_size, :container_type,
                :charge_code, :description, :price, :cost, :currency, :uom,
                :is_domestic, :paid_with_freight,
                :effective_from, :effective_to, :is_active,
                :created_at, :updated_at
            )
            ON CONFLICT ON CONSTRAINT lc_unique DO NOTHING
        """)

        with engine.connect() as conn:
            for row in rows_to_insert:
                result = conn.execute(insert_sql, row)
                if result.rowcount > 0:
                    inserted += 1
                else:
                    skipped_conflict += 1
            conn.commit()

        print(f"[LIVE] Inserted {inserted} rows. Skipped (conflict/duplicate): {skipped_conflict}. Skipped (validation): {len(skipped_uom) + skipped_no_item + skipped_month + skipped_direction + skipped_container_size_total + skipped_container_type_total}.")

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  PricingLocalCharges entities fetched: {len(items_raw)}")
    print(f"  PTMonthlyRatePortCharges rate entries fetched: {len(rates_raw)}")
    print(f"  Port codes remapped (MYPKG_N → MYPKG): {len(remapped_ports)}")
    print(f"  Container types remapped (DRY→GP, REEFER→RF): {container_type_remapped_count}")
    print(f"  UOM remapped (CTR→CONTAINER, RT→W/M, CW→CW_KG, C3KG→RAIL_3KG): {uom_remapped_count}")
    print(f"  Rows passed transformation: {len(rows_to_insert)}")
    if DRY_RUN:
        print(f"  Rows would insert: {len(rows_to_insert)}")
    else:
        print(f"  Rows inserted: {inserted}")
        print(f"  Rows skipped (conflict): {skipped_conflict}")
    print(f"  Rows skipped (validation):")
    print(f"    - Port not in ports table: {len(skipped_ports)}")
    print(f"    - No matching item / port invalid: {skipped_no_item}")
    print(f"    - Invalid UOM: {len(skipped_uom)}")
    print(f"    - Invalid month_year: {skipped_month}")
    print(f"    - Invalid trade_direction: {skipped_direction}")
    print(f"    - Invalid container_size: {skipped_container_size_total} {dict(skipped_container_size_map) if skipped_container_size_map else ''}")
    print(f"    - Invalid container_type: {skipped_container_type_total} {dict(skipped_container_type_map) if skipped_container_type_map else ''}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
