"""
scripts/migrate_pricing_freight.py

Migrate FCL and LCL pricing data from Google Cloud Datastore to PostgreSQL.

Reads:
  - PricingFCL / PricingLCL — rate card definitions
  - PTMonthlyRateOceanAir — rate history records (2024+)

Usage:
    cd af-server
    .venv/Scripts/python scripts/migrate_pricing_freight.py
    .venv/Scripts/python scripts/migrate_pricing_freight.py --dry-run
"""

import argparse
import json
import logging
import sys
import os
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

from sqlalchemy import text
from core.db import get_engine
from google.cloud import datastore

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Month name → month number
_MONTH_MAP = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}

BATCH_SIZE = 500

# Legacy port code normalisation — maps non-standard Datastore codes to canonical UN/LOCODE
# MYPKG_N (Port Klang North Port) → MYPKG (Port Klang, default terminal WP)
# Add further mappings here as discovered via diagnose_pricing_warnings.py
_PORT_CODE_MAP: dict[str, str] = {
    "MYPKG_N": "MYPKG",
}

# Maps legacy port code suffixes to canonical terminal_id
# where the legacy code implies a specific terminal
_PORT_TERMINAL_MAP: dict[str, str] = {
    "MYPKG_N": "MYPKG_N",  # Northport terminal
}


def _normalise_port_code(code: str) -> str:
    """Map legacy port code variants to canonical UN/LOCODE. Pass-through if not mapped."""
    return _PORT_CODE_MAP.get(code, code)


def _get_terminal_id(original_code: str) -> str | None:
    """Return terminal_id if the original code implies a specific terminal."""
    return _PORT_TERMINAL_MAP.get(original_code)


# Malaysian port code prefix — used to detect domestic MY-MY lanes
_MY_PREFIX = "MY"


def _default_currency(pt_id: str) -> str:
    """Derive default currency from rate card key (pt_id).

    Format: 'ORIGIN:DEST:...' e.g. 'CNSHA:MYPKG:NON-DG'
    Rule: if both origin and destination start with 'MY' → MYR, else USD.
    Applies only when the Datastore record has no currency set.
    """
    parts = pt_id.split(":")
    if len(parts) >= 2:
        origin = _normalise_port_code(parts[0])
        dest = _normalise_port_code(parts[1])
        if origin.startswith(_MY_PREFIX) and dest.startswith(_MY_PREFIX):
            return "MYR"
    return "USD"


def _parse_month_year(month_year: str) -> date | None:
    """Convert 'JAN-2024' to date(2024, 1, 1)."""
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


def _safe_numeric(val) -> float | None:
    """Safely convert a value to float, returning None for invalid/missing."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def migrate_fcl_rate_cards(ds_client, conn, dry_run: bool) -> dict[str, int]:
    """Migrate PricingFCL → fcl_rate_cards. Returns {rate_card_key: id}."""
    logger.info("\n=== Step 1: FCL Rate Cards ===")
    query = ds_client.query(kind="PricingFCL")
    entities = list(query.fetch())

    card_map: dict[str, int] = {}
    migrated = 0
    skipped_trash = 0

    for e in entities:
        if e.get("trash", False):
            skipped_trash += 1
            continue

        rate_card_key = e.get("pt_id", "")
        if not rate_card_key:
            logger.warning("  WARN: PricingFCL entity with no pt_id, skipping")
            continue

        if dry_run:
            migrated += 1
            card_map[rate_card_key] = -1
            continue

        original_dest = e.get("port_destination_un_code", "")
        terminal_id = _get_terminal_id(original_dest)

        row = conn.execute(text("""
            INSERT INTO fcl_rate_cards
                (rate_card_key, origin_port_code, destination_port_code,
                 dg_class_code, container_size, container_type, code, description, terminal_id)
            VALUES (:key, :origin, :dest, :dg, :size, :type, :code, :desc, :terminal_id)
            ON CONFLICT (rate_card_key) DO NOTHING
            RETURNING id
        """), {
            "key": rate_card_key,
            "origin": _normalise_port_code(e.get("port_origin_un_code", "")),
            "dest": _normalise_port_code(original_dest),
            "dg": e.get("dg_class_code", "NON-DG"),
            "size": e.get("container_size", ""),
            "type": e.get("container_type", ""),
            "code": e.get("code", ""),
            "desc": e.get("description", ""),
            "terminal_id": terminal_id,
        }).fetchone()

        if row:
            card_map[rate_card_key] = row[0]
            migrated += 1
        else:
            # Already existed — fetch id
            existing = conn.execute(text(
                "SELECT id FROM fcl_rate_cards WHERE rate_card_key = :key"
            ), {"key": rate_card_key}).fetchone()
            if existing:
                card_map[rate_card_key] = existing[0]

    logger.info(f"  FCL rate cards: {migrated} migrated, {skipped_trash} trashed/skipped")
    return card_map


def migrate_lcl_rate_cards(ds_client, conn, dry_run: bool) -> dict[str, int]:
    """Migrate PricingLCL → lcl_rate_cards. Returns {rate_card_key: id}."""
    logger.info("\n=== Step 2: LCL Rate Cards ===")
    query = ds_client.query(kind="PricingLCL")
    entities = list(query.fetch())

    card_map: dict[str, int] = {}
    migrated = 0
    skipped_trash = 0

    for e in entities:
        if e.get("trash", False):
            skipped_trash += 1
            continue

        rate_card_key = e.get("pt_id", "")
        if not rate_card_key:
            logger.warning("  WARN: PricingLCL entity with no pt_id, skipping")
            continue

        if dry_run:
            migrated += 1
            card_map[rate_card_key] = -1
            continue

        original_dest = e.get("port_destination_un_code", "")
        terminal_id = _get_terminal_id(original_dest)

        row = conn.execute(text("""
            INSERT INTO lcl_rate_cards
                (rate_card_key, origin_port_code, destination_port_code,
                 dg_class_code, code, description, terminal_id)
            VALUES (:key, :origin, :dest, :dg, :code, :desc, :terminal_id)
            ON CONFLICT (rate_card_key) DO NOTHING
            RETURNING id
        """), {
            "key": rate_card_key,
            "origin": _normalise_port_code(e.get("port_origin_un_code", "")),
            "dest": _normalise_port_code(original_dest),
            "dg": e.get("dg_class_code", "NON-DG"),
            "code": e.get("code", ""),
            "desc": e.get("description", ""),
            "terminal_id": terminal_id,
        }).fetchone()

        if row:
            card_map[rate_card_key] = row[0]
            migrated += 1
        else:
            existing = conn.execute(text(
                "SELECT id FROM lcl_rate_cards WHERE rate_card_key = :key"
            ), {"key": rate_card_key}).fetchone()
            if existing:
                card_map[rate_card_key] = existing[0]

    logger.info(f"  LCL rate cards: {migrated} migrated, {skipped_trash} trashed/skipped")
    return card_map


def migrate_rates(ds_client, conn, fcl_map: dict[str, int], lcl_map: dict[str, int], dry_run: bool):
    """Migrate PTMonthlyRateOceanAir → fcl_rates / lcl_rates."""
    logger.info("\n=== Step 3 & 4: Rate History ===")

    query = ds_client.query(kind="PTMonthlyRateOceanAir")
    entities = list(query.fetch())

    fcl_batch: list[dict] = []
    lcl_batch: list[dict] = []
    fcl_total = 0
    lcl_total = 0
    skipped_old = 0
    skipped_no_card = 0
    warnings = 0

    for e in entities:
        kind = e.get("kind", "")
        month_year = e.get("month_year", "")
        effective_from = _parse_month_year(month_year)

        if not effective_from:
            skipped_old += 1
            continue

        # Only migrate 2024+
        if effective_from.year < 2024:
            skipped_old += 1
            continue

        pt_id = e.get("pt_id", "")
        is_price = e.get("is_price", False)
        supplier_id = None if is_price else e.get("supplier_id")

        # Determine currency/uom with defaults
        currency = e.get("currency") or ""
        uom = e.get("uom") or ""

        # Extract nested price/cost/charges
        price_data = e.get("price") or {}
        cost_data = e.get("cost") or {}
        charges = e.get("charges") or {}

        if kind == "PT-FCL":
            if pt_id not in fcl_map:
                skipped_no_card += 1
                continue
            if not currency:
                currency = _default_currency(pt_id)
                warnings += 1
                logger.warning(f"  WARN: FCL rate {pt_id}/{month_year} missing currency, defaulting {currency}")
            if not uom:
                uom = "CONTAINER"
                warnings += 1

            row_data = {
                "rate_card_id": fcl_map[pt_id],
                "supplier_id": supplier_id,
                "effective_from": effective_from,
                "currency": currency,
                "uom": uom,
                "list_price": _safe_numeric(price_data.get("price")),
                "min_list_price": _safe_numeric(price_data.get("min_price")),
                "cost": _safe_numeric(cost_data.get("cost")),
                "min_cost": _safe_numeric(cost_data.get("min_cost")),
                "roundup_qty": int(e.get("roundup_qty", 0) or 0),
                "lss": _safe_numeric(charges.get("low_sulfur_surcharge")) or 0,
                "baf": _safe_numeric(charges.get("bunker_adjustment_factor")) or 0,
                "ecrs": _safe_numeric(charges.get("emergency_cost_recovery_surcharge")) or 0,
                "psc": _safe_numeric(charges.get("peak_season_surcharge")) or 0,
            }
            fcl_batch.append(row_data)
            fcl_total += 1

            if not dry_run and len(fcl_batch) >= BATCH_SIZE:
                _insert_fcl_rates(conn, fcl_batch)
                fcl_batch.clear()

        elif kind == "PT-LCL":
            if pt_id not in lcl_map:
                skipped_no_card += 1
                continue
            if not currency:
                currency = _default_currency(pt_id)
                warnings += 1
                logger.warning(f"  WARN: LCL rate {pt_id}/{month_year} missing currency, defaulting {currency}")
            if not uom:
                uom = "W/M"
                warnings += 1

            row_data = {
                "rate_card_id": lcl_map[pt_id],
                "supplier_id": supplier_id,
                "effective_from": effective_from,
                "currency": currency,
                "uom": uom,
                "list_price": _safe_numeric(price_data.get("price")),
                "min_list_price": _safe_numeric(price_data.get("min_price")),
                "cost": _safe_numeric(cost_data.get("cost")),
                "min_cost": _safe_numeric(cost_data.get("min_cost")),
                "roundup_qty": int(e.get("roundup_qty", 0) or 0),
                "lss": _safe_numeric(charges.get("low_sulfur_surcharge")) or 0,
                "baf": _safe_numeric(charges.get("bunker_adjustment_factor")) or 0,
                "ecrs": _safe_numeric(charges.get("emergency_cost_recovery_surcharge")) or 0,
                "psc": _safe_numeric(charges.get("peak_season_surcharge")) or 0,
            }
            lcl_batch.append(row_data)
            lcl_total += 1

            if not dry_run and len(lcl_batch) >= BATCH_SIZE:
                _insert_lcl_rates(conn, lcl_batch)
                lcl_batch.clear()

    # Flush remaining
    if not dry_run:
        if fcl_batch:
            _insert_fcl_rates(conn, fcl_batch)
        if lcl_batch:
            _insert_lcl_rates(conn, lcl_batch)

    logger.info(f"  FCL rates: {fcl_total}")
    logger.info(f"  LCL rates: {lcl_total}")
    logger.info(f"  Skipped (pre-2024 or invalid date): {skipped_old}")
    logger.info(f"  Skipped (no matching rate card): {skipped_no_card}")
    logger.info(f"  Warnings: {warnings}")


def _insert_fcl_rates(conn, batch: list[dict]):
    conn.execute(text("""
        INSERT INTO fcl_rates
            (rate_card_id, supplier_id, effective_from, currency, uom,
             list_price, min_list_price, cost, min_cost,
             roundup_qty, lss, baf, ecrs, psc)
        VALUES
            (:rate_card_id, :supplier_id, :effective_from, :currency, :uom,
             :list_price, :min_list_price, :cost, :min_cost,
             :roundup_qty, :lss, :baf, :ecrs, :psc)
    """), batch)


def _insert_lcl_rates(conn, batch: list[dict]):
    conn.execute(text("""
        INSERT INTO lcl_rates
            (rate_card_id, supplier_id, effective_from, currency, uom,
             list_price, min_list_price, cost, min_cost,
             roundup_qty, lss, baf, ecrs, psc)
        VALUES
            (:rate_card_id, :supplier_id, :effective_from, :currency, :uom,
             :list_price, :min_list_price, :cost, :min_cost,
             :roundup_qty, :lss, :baf, :ecrs, :psc)
    """), batch)


def main():
    parser = argparse.ArgumentParser(description="Migrate FCL/LCL pricing from Datastore to PostgreSQL")
    parser.add_argument("--dry-run", action="store_true", help="Print counts only, no DB writes")
    args = parser.parse_args()

    ds_client = datastore.Client()
    get_engine.cache_clear()  # Clear lru_cache — ensures no stale engine from pre-migration state
    engine = get_engine()
    engine.dispose()  # Force fresh connections — ensures post-migration schema is visible

    with engine.connect() as conn:
        fcl_map = migrate_fcl_rate_cards(ds_client, conn, args.dry_run)
        lcl_map = migrate_lcl_rate_cards(ds_client, conn, args.dry_run)
        migrate_rates(ds_client, conn, fcl_map, lcl_map, args.dry_run)

        if not args.dry_run:
            conn.commit()

    prefix = "DRY RUN — " if args.dry_run else ""
    logger.info(f"\n{prefix}Migration complete.")
    logger.info(f"  FCL rate cards: {len(fcl_map)}")
    logger.info(f"  LCL rate cards: {len(lcl_map)}")


if __name__ == "__main__":
    main()
