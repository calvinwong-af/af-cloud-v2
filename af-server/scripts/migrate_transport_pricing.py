"""
scripts/migrate_transport_pricing.py

Migrate PricingTransport + PTMonthlyRateHaulageTransport (kind=PT-TRANSPORT)
from Google Cloud Datastore to PostgreSQL port_transport_rate_cards + port_transport_rates.

Field mapping:
  PricingTransport (Datastore kind)     → port_transport_rate_cards
    port_un_code                        → port_un_code
    city_code                           → area_id (looked up via areas table)
    tonnage (int)                       → vehicle_type_id (looked up via vehicle_types)
    include_depot_gate_fee              → include_depot_gate_fee
    trash                               → is_active (inverted)

  PTMonthlyRateHaulageTransport         → port_transport_rates
    (where kind = 'PT-TRANSPORT')
    is_price=True, supplier_id=None     → supplier_id = NULL (list price reference)
    is_price=False                      → supplier_id = supplier_id
    price.price                         → list_price
    price.min_price                     → min_list_price
    cost.cost                           → cost
    cost.min_cost                       → min_cost
    charges.toll_fee etc.               → surcharges JSONB
    month_year (JAN-2024)               → effective_from (first of month)
    roundup_qty                         → roundup_qty
    uom                                 → uom (default: SET)
    currency                            → currency (default: MYR)

Tonnage → vehicle_type_id mapping:
  Datastore TransportTonnage uses integer ton keys (3, 5, 10, etc.)
  New vehicle_types table uses string ids (lorry_3t, lorry_5t, lorry_10t, etc.)
  This script builds the mapping from vehicle_types at runtime — no hardcoding.

Areas mapping:
  Datastore city_code (e.g. MY-SGR-001) maps to areas.area_code
  area_id is looked up from the areas table at runtime.

Rate date handling:
  Monthly rates → effective_from = first day of that month
  effective_to = NULL (open-ended) for the most recent rate per card+supplier
  For older months: effective_to = effective_from of the next month - 1 day
  (We close each month's rate when a newer month exists for same card+supplier)

Run from af-server root with Cloud SQL Auth Proxy running and venv active:
    .venv\\Scripts\\python scripts\\migrate_transport_pricing.py
    .venv\\Scripts\\python scripts\\migrate_transport_pricing.py --dry-run
"""

import argparse
import logging
import os
import sys
from collections import defaultdict
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

from sqlalchemy import text
from core.db import get_engine
from google.cloud import datastore

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

PROJECT_ID = 'cloud-accele-freight'
KIND_PRICING_TRANSPORT = 'PricingTransport'
KIND_MONTHLY_RATE = 'PTMonthlyRateHaulageTransport'
PT_TRANSPORT = 'PT-TRANSPORT'
PRICE = 'PRICE'

_MONTH_MAP = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}

BATCH_SIZE = 500


def _parse_month_year(month_year: str) -> date | None:
    """Convert 'JAN-2024' → date(2024, 1, 1)."""
    if not month_year or "-" not in month_year:
        return None
    parts = month_year.strip().upper().split("-")
    if len(parts) != 2:
        return None
    month_str, year_str = parts
    month = _MONTH_MAP.get(month_str)
    if not month:
        return None
    try:
        year = int(year_str)
    except ValueError:
        return None
    return date(year, month, 1)


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _safe_int(val, default=0) -> int:
    if val is None:
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


# ---------------------------------------------------------------------------
# Step 1: Load reference data from PostgreSQL
# ---------------------------------------------------------------------------

def load_areas_map(conn) -> dict[str, int]:
    """Returns {area_code: area_id} from the areas table."""
    rows = conn.execute(text("SELECT area_code, area_id FROM areas")).fetchall()
    return {r[0]: r[1] for r in rows}


def load_vehicle_types_map(conn) -> dict[int, str]:
    """
    Returns {tonnage_int: vehicle_type_id} by parsing vehicle_type_id labels.
    vehicle_type_id format expected: lorry_3t, lorry_5t, lorry_10t, van_1t etc.
    Parses the numeric portion before 't' as the tonnage integer key.
    """
    rows = conn.execute(text(
        "SELECT vehicle_type_id FROM vehicle_types WHERE is_active = true"
    )).fetchall()

    mapping: dict[int, str] = {}
    for (vt_id,) in rows:
        # Parse e.g. "lorry_3t" → 3, "lorry_10t" → 10, "van_1t" → 1
        try:
            # Take the part after the last '_' and strip 't'
            suffix = vt_id.split("_")[-1]
            if suffix.endswith("t"):
                ton = int(suffix[:-1])
                mapping[ton] = vt_id
        except (ValueError, IndexError):
            pass

    if mapping:
        logger.info(f"  Vehicle type mappings loaded: {dict(sorted(mapping.items()))}")
    else:
        logger.warning("  WARNING: No vehicle_type_id entries could be parsed. Check vehicle_types table.")

    return mapping


# ---------------------------------------------------------------------------
# Step 2: Migrate PricingTransport → port_transport_rate_cards
# ---------------------------------------------------------------------------

def migrate_rate_cards(
    ds_client,
    conn,
    areas_map: dict[str, int],
    vehicle_map: dict[int, str],
    dry_run: bool,
) -> dict[int, int]:
    """
    Migrate PricingTransport Datastore kind → port_transport_rate_cards.
    Returns {datastore_pt_id: transport_rate_card_db_id}.
    """
    logger.info("\n=== Step 2: Transport Rate Cards ===")

    query = ds_client.query(kind=KIND_PRICING_TRANSPORT)
    entities = list(query.fetch())
    logger.info(f"  Fetched {len(entities)} PricingTransport entities from Datastore")

    card_map: dict[int, int] = {}
    migrated = 0
    skipped_trash = 0
    skipped_no_area = 0
    skipped_no_vehicle = 0
    skipped_no_city = 0

    for e in entities:
        pt_id = e.key.id_or_name
        if not pt_id:
            logger.warning("  WARN: PricingTransport entity with no key id, skipping")
            continue

        if e.get("trash", False):
            skipped_trash += 1
            continue

        port_un_code = (e.get("port_un_code") or "").strip()
        city_code = (e.get("city_code") or "").strip()
        tonnage = _safe_int(e.get("tonnage"), default=None)
        include_dgf = bool(e.get("include_depot_gate_fee", False))

        if not city_code:
            skipped_no_city += 1
            logger.warning(f"  WARN: pt_id={pt_id} has no city_code, skipping")
            continue

        # Resolve area_id
        area_id = areas_map.get(city_code)
        if area_id is None:
            skipped_no_area += 1
            logger.warning(f"  WARN: pt_id={pt_id} city_code={city_code!r} not found in areas table, skipping")
            continue

        # Resolve vehicle_type_id
        if tonnage is None:
            skipped_no_vehicle += 1
            logger.warning(f"  WARN: pt_id={pt_id} has no tonnage, skipping")
            continue

        vehicle_type_id = vehicle_map.get(tonnage)
        if vehicle_type_id is None:
            skipped_no_vehicle += 1
            logger.warning(f"  WARN: pt_id={pt_id} tonnage={tonnage} not found in vehicle_types, skipping")
            continue

        rate_card_key = f"{port_un_code}:{area_id}:{vehicle_type_id}"
        is_active = not bool(e.get("trash", False))

        if dry_run:
            migrated += 1
            card_map[int(pt_id)] = -1
            logger.info(f"  [DRY RUN] Would insert: pt_id={pt_id} key={rate_card_key} dgf={include_dgf}")
            continue

        row = conn.execute(text("""
            INSERT INTO port_transport_rate_cards
                (rate_card_key, port_un_code, area_id, vehicle_type_id,
                 include_depot_gate_fee, is_active)
            VALUES
                (:key, :port, :area_id, :vehicle_type_id, :dgf, :active)
            ON CONFLICT (rate_card_key) DO NOTHING
            RETURNING id
        """), {
            "key": rate_card_key,
            "port": port_un_code,
            "area_id": area_id,
            "vehicle_type_id": vehicle_type_id,
            "dgf": include_dgf,
            "active": is_active,
        }).fetchone()

        if row:
            card_map[int(pt_id)] = row[0]
            migrated += 1
        else:
            # Already exists — fetch id
            existing = conn.execute(text(
                "SELECT id FROM port_transport_rate_cards WHERE rate_card_key = :key"
            ), {"key": rate_card_key}).fetchone()
            if existing:
                card_map[int(pt_id)] = existing[0]

    logger.info(f"  Migrated: {migrated}")
    logger.info(f"  Skipped (trashed): {skipped_trash}")
    logger.info(f"  Skipped (no city_code): {skipped_no_city}")
    logger.info(f"  Skipped (area not found): {skipped_no_area}")
    logger.info(f"  Skipped (tonnage/vehicle not found): {skipped_no_vehicle}")
    logger.info(f"  Card map size: {len(card_map)}")
    return card_map


# ---------------------------------------------------------------------------
# Step 3: Migrate PTMonthlyRateHaulageTransport (PT-TRANSPORT) → port_transport_rates
# ---------------------------------------------------------------------------

def migrate_rates(
    ds_client,
    conn,
    card_map: dict[int, int],
    dry_run: bool,
):
    """
    Migrate PTMonthlyRateHaulageTransport (kind=PT-TRANSPORT) → port_transport_rates.

    Monthly rates are converted to effective_from/to date ranges:
    - Each month_year row → effective_from = 1st of that month
    - After collecting all rows per card+supplier, sort by date and close earlier
      rows: effective_to = next_effective_from - 1 day
    - Most recent row stays open-ended (effective_to = NULL)
    - Only migrates 2024+ data (matching freight migration pattern)
    """
    logger.info("\n=== Step 3: Transport Rates ===")

    query = ds_client.query(kind=KIND_MONTHLY_RATE)
    query.add_filter("kind", "=", PT_TRANSPORT)
    entities = list(query.fetch())
    logger.info(f"  Fetched {len(entities)} PT-TRANSPORT rate entities from Datastore")

    # Group by (rate_card_id, supplier_id) → list of rate dicts sorted by date
    # supplier_id = None for price reference rows (is_price=True)
    grouped: dict[tuple[int, str | None], list[dict]] = defaultdict(list)

    skipped_old = 0
    skipped_no_card = 0
    parse_errors = 0

    for e in entities:
        month_year = e.get("month_year", "")
        effective_from = _parse_month_year(month_year)

        if not effective_from:
            parse_errors += 1
            continue

        # Only migrate 2024+
        if effective_from.year < 2024:
            skipped_old += 1
            continue

        pt_id_raw = e.get("pt_id")
        try:
            pt_id = int(pt_id_raw)
        except (TypeError, ValueError):
            parse_errors += 1
            logger.warning(f"  WARN: Could not parse pt_id={pt_id_raw!r}, skipping")
            continue

        if pt_id not in card_map:
            skipped_no_card += 1
            continue

        db_card_id = card_map[pt_id]
        if db_card_id == -1:
            # dry run placeholder
            continue

        is_price = bool(e.get("is_price", False))
        supplier_id = None if is_price else (e.get("supplier_id") or None)

        # Extract price/cost
        price_data = e.get("price") or {}
        cost_data = e.get("cost") or {}
        charges_data = e.get("charges") or {}

        # Build surcharges JSONB from legacy charges
        surcharges = []
        for charge_key, charge_label in [
            ("toll_fee", "Toll Fee"),
            ("side_loader_surcharge", "Side Loader Surcharge"),
        ]:
            val = _safe_float(charges_data.get(charge_key))
            if val is not None and val > 0:
                surcharges.append({
                    "code": charge_key.upper(),
                    "description": charge_label,
                    "amount": val,
                })

        grouped[(db_card_id, supplier_id)].append({
            "rate_card_id": db_card_id,
            "supplier_id": supplier_id,
            "effective_from": effective_from,
            "currency": (e.get("currency") or "MYR").strip(),
            "uom": (e.get("uom") or "SET").strip(),
            "list_price": _safe_float(price_data.get("price")) if is_price else None,
            "min_list_price": _safe_float(price_data.get("min_price")) if is_price else None,
            "cost": _safe_float(cost_data.get("cost")) if not is_price else None,
            "min_cost": _safe_float(cost_data.get("min_cost")) if not is_price else None,
            "surcharges": surcharges if surcharges else None,
            "roundup_qty": _safe_int(e.get("roundup_qty"), default=0),
            "rate_status": "PUBLISHED",
        })

    logger.info(f"  Skipped (pre-2024): {skipped_old}")
    logger.info(f"  Skipped (no matching rate card): {skipped_no_card}")
    logger.info(f"  Parse errors: {parse_errors}")
    logger.info(f"  Groups (card+supplier combos): {len(grouped)}")

    if dry_run:
        total_rows = sum(len(v) for v in grouped.values())
        logger.info(f"  [DRY RUN] Would insert {total_rows} port_transport_rates rows")
        return

    # Insert with date range closing
    batch: list[dict] = []
    total_inserted = 0

    for (db_card_id, supplier_id), rows in grouped.items():
        # Sort by effective_from ascending
        rows.sort(key=lambda r: r["effective_from"])

        for i, row in enumerate(rows):
            # Close this row if there's a newer one for same card+supplier
            if i < len(rows) - 1:
                next_from = rows[i + 1]["effective_from"]
                row["effective_to"] = next_from - timedelta(days=1)
            else:
                row["effective_to"] = None  # open-ended — most recent

            import json
            batch.append({
                "rate_card_id": row["rate_card_id"],
                "supplier_id": row["supplier_id"],
                "effective_from": row["effective_from"],
                "effective_to": row["effective_to"],
                "rate_status": row["rate_status"],
                "currency": row["currency"],
                "uom": row["uom"],
                "list_price": row["list_price"],
                "min_list_price": row["min_list_price"],
                "cost": row["cost"],
                "min_cost": row["min_cost"],
                "surcharges": json.dumps(row["surcharges"]) if row["surcharges"] else None,
                "roundup_qty": row["roundup_qty"],
            })
            total_inserted += 1

            if len(batch) >= BATCH_SIZE:
                _insert_rates(conn, batch)
                batch.clear()

    if batch:
        _insert_rates(conn, batch)

    logger.info(f"  port_transport_rates rows inserted: {total_inserted}")


def _insert_rates(conn, batch: list[dict]):
    conn.execute(text("""
        INSERT INTO port_transport_rates
            (rate_card_id, supplier_id, effective_from, effective_to,
             rate_status, currency, uom,
             list_price, min_list_price, cost, min_cost,
             surcharges, roundup_qty)
        VALUES
            (:rate_card_id, :supplier_id, :effective_from, :effective_to,
             :rate_status, :currency, :uom,
             :list_price, :min_list_price, :cost, :min_cost,
             :surcharges::jsonb, :roundup_qty)
    """), batch)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Migrate PricingTransport from Datastore to PostgreSQL"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Print counts only — no DB writes")
    args = parser.parse_args()

    key_file = os.path.join(os.path.dirname(__file__), '..', 'cloud-accele-freight-key.json')
    if os.path.exists(key_file):
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.abspath(key_file)

    ds_client = datastore.Client(project=PROJECT_ID)
    engine = get_engine()

    with engine.connect() as conn:
        # Step 1: Load reference maps from PostgreSQL
        logger.info("\n=== Step 1: Loading reference data from PostgreSQL ===")
        areas_map = load_areas_map(conn)
        logger.info(f"  Areas loaded: {len(areas_map)}")
        vehicle_map = load_vehicle_types_map(conn)
        logger.info(f"  Vehicle types loaded: {len(vehicle_map)}")

        if not areas_map:
            logger.error("  ERROR: No areas found in DB. Run migrate_haulage_areas.py first.")
            sys.exit(1)

        if not vehicle_map:
            logger.error("  ERROR: No vehicle_types found in DB. Check migration 009.")
            sys.exit(1)

        # Step 2: Rate cards
        card_map = migrate_rate_cards(ds_client, conn, areas_map, vehicle_map, args.dry_run)

        # Step 3: Rates
        migrate_rates(ds_client, conn, card_map, args.dry_run)

        if not args.dry_run:
            conn.commit()

    prefix = "DRY RUN — " if args.dry_run else ""
    logger.info(f"\n{prefix}Migration complete.")
    logger.info(f"  Rate cards mapped: {len(card_map)}")


if __name__ == "__main__":
    main()
