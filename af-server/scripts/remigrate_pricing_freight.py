"""
scripts/remigrate_pricing_freight.py

Re-runnable pricing migration — syncs FCL/LCL rate cards and rate history
from Datastore without duplicating existing records.

Differences from migrate_pricing_freight.py:
  - Rate cards: ON CONFLICT DO NOTHING (same as original — safe)
  - Rates: deletes existing rates for each card before re-inserting,
    so re-runs are idempotent. Only affects cards present in Datastore.
  - No year cutoff — migrates ALL years so historical data from any
    origin port is captured (original script was 2024+ only).
  - Dry-run mode prints origin port breakdown so you can see exactly
    what ports exist in Datastore before committing.

Usage:
    cd af-server
    .venv/Scripts/python scripts/remigrate_pricing_freight.py --dry-run
    .venv/Scripts/python scripts/remigrate_pricing_freight.py
"""

import argparse
import logging
import sys
import os
from collections import defaultdict
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

from sqlalchemy import text
from core.db import get_engine
from google.cloud import datastore

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

_MONTH_MAP = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}

BATCH_SIZE = 500

_PORT_CODE_MAP: dict[str, str] = {
    "MYPKG_N": "MYPKG",
}

_PORT_TERMINAL_MAP: dict[str, str] = {
    "MYPKG_N": "MYPKG_N",
}


def _normalise_port_code(code: str) -> str:
    return _PORT_CODE_MAP.get(code, code)


def _get_terminal_id(original_code: str) -> str | None:
    return _PORT_TERMINAL_MAP.get(original_code)


def _default_currency(pt_id: str) -> str:
    parts = pt_id.split(":")
    if len(parts) >= 2:
        origin = _normalise_port_code(parts[0])
        dest = _normalise_port_code(parts[1])
        if origin.startswith("MY") and dest.startswith("MY"):
            return "MYR"
    return "USD"


def _parse_month_year(month_year: str) -> date | None:
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
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Step 1 & 2: Rate cards
# ---------------------------------------------------------------------------

def sync_fcl_rate_cards(ds_client, conn, dry_run: bool) -> dict[str, int]:
    logger.info("\n=== Step 1: FCL Rate Cards ===")
    entities = list(ds_client.query(kind="PricingFCL").fetch())

    card_map: dict[str, int] = {}
    origins: dict[str, int] = defaultdict(int)
    inserted = skipped_trash = already_existed = 0

    for e in entities:
        if e.get("trash", False):
            skipped_trash += 1
            continue

        pt_id = e.get("pt_id", "")
        if not pt_id:
            continue

        origin = _normalise_port_code(e.get("port_origin_un_code", ""))
        origins[origin] += 1

        if dry_run:
            inserted += 1
            card_map[pt_id] = -1
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
            "key": pt_id,
            "origin": origin,
            "dest": _normalise_port_code(original_dest),
            "dg": e.get("dg_class_code", "NON-DG"),
            "size": e.get("container_size", ""),
            "type": e.get("container_type", ""),
            "code": e.get("code", ""),
            "desc": e.get("description", ""),
            "terminal_id": terminal_id,
        }).fetchone()

        if row:
            card_map[pt_id] = row[0]
            inserted += 1
        else:
            existing = conn.execute(text(
                "SELECT id FROM fcl_rate_cards WHERE rate_card_key = :key"
            ), {"key": pt_id}).fetchone()
            if existing:
                card_map[pt_id] = existing[0]
                already_existed += 1

    logger.info(f"  FCL rate cards: {inserted} new, {already_existed} already existed, {skipped_trash} trashed")
    logger.info("  Origin port breakdown (from Datastore):")
    for code in sorted(origins.keys()):
        logger.info(f"    {code:<10} {origins[code]:>4} cards")

    return card_map


def sync_lcl_rate_cards(ds_client, conn, dry_run: bool) -> dict[str, int]:
    logger.info("\n=== Step 2: LCL Rate Cards ===")
    entities = list(ds_client.query(kind="PricingLCL").fetch())

    card_map: dict[str, int] = {}
    origins: dict[str, int] = defaultdict(int)
    inserted = skipped_trash = already_existed = 0

    for e in entities:
        if e.get("trash", False):
            skipped_trash += 1
            continue

        pt_id = e.get("pt_id", "")
        if not pt_id:
            continue

        origin = _normalise_port_code(e.get("port_origin_un_code", ""))
        origins[origin] += 1

        if dry_run:
            inserted += 1
            card_map[pt_id] = -1
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
            "key": pt_id,
            "origin": origin,
            "dest": _normalise_port_code(original_dest),
            "dg": e.get("dg_class_code", "NON-DG"),
            "code": e.get("code", ""),
            "desc": e.get("description", ""),
            "terminal_id": terminal_id,
        }).fetchone()

        if row:
            card_map[pt_id] = row[0]
            inserted += 1
        else:
            existing = conn.execute(text(
                "SELECT id FROM lcl_rate_cards WHERE rate_card_key = :key"
            ), {"key": pt_id}).fetchone()
            if existing:
                card_map[pt_id] = existing[0]
                already_existed += 1

    logger.info(f"  LCL rate cards: {inserted} new, {already_existed} already existed, {skipped_trash} trashed")
    logger.info("  Origin port breakdown (from Datastore):")
    for code in sorted(origins.keys()):
        logger.info(f"    {code:<10} {origins[code]:>4} cards")

    return card_map


# ---------------------------------------------------------------------------
# Step 3 & 4: Rates (delete-then-insert per card for idempotency)
# ---------------------------------------------------------------------------

def sync_rates(ds_client, conn, fcl_map: dict[str, int], lcl_map: dict[str, int], dry_run: bool):
    logger.info("\n=== Step 3 & 4: Rate History (all years) ===")

    # Stream entities in pages of 500 rather than fetching all at once
    query = ds_client.query(kind="PTMonthlyRateOceanAir")
    query.keys_only = False

    # Group rates by card id first, then delete+insert per card
    fcl_by_card: dict[int, list[dict]] = defaultdict(list)
    lcl_by_card: dict[int, list[dict]] = defaultdict(list)
    skipped_no_date = skipped_no_card = warnings = 0
    fetched = 0

    logger.info("  Fetching rate entities from Datastore (streaming)...")
    for e in query.fetch(eventual=True):
        fetched += 1
        if fetched % 5000 == 0:
            logger.info(f"  ... {fetched} entities fetched so far")
        kind = e.get("kind", "")
        month_year = e.get("month_year", "")
        effective_from = _parse_month_year(month_year)

        if not effective_from:
            skipped_no_date += 1
            continue

        pt_id = e.get("pt_id", "")
        is_price = e.get("is_price", False)
        supplier_id = None if is_price else e.get("supplier_id")

        currency = e.get("currency") or ""
        uom = e.get("uom") or ""
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
            if not uom:
                uom = "CONTAINER"
                warnings += 1
            fcl_by_card[fcl_map[pt_id]].append({
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
            })

        elif kind == "PT-LCL":
            if pt_id not in lcl_map:
                skipped_no_card += 1
                continue
            if not currency:
                currency = _default_currency(pt_id)
                warnings += 1
            if not uom:
                uom = "W/M"
                warnings += 1
            lcl_by_card[lcl_map[pt_id]].append({
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
            })

    fcl_total = sum(len(v) for v in fcl_by_card.values())
    lcl_total = sum(len(v) for v in lcl_by_card.values())

    logger.info(f"  Total entities fetched: {fetched}")
    logger.info(f"  FCL rates to sync: {fcl_total} across {len(fcl_by_card)} cards")
    logger.info(f"  LCL rates to sync: {lcl_total} across {len(lcl_by_card)} cards")
    logger.info(f"  Skipped (invalid date): {skipped_no_date}")
    logger.info(f"  Skipped (no matching rate card): {skipped_no_card}")
    logger.info(f"  Currency/UOM warnings defaulted: {warnings}")

    if dry_run:
        return

    # Delete existing rates for all affected cards, then re-insert
    fcl_card_ids = list(fcl_by_card.keys())
    if fcl_card_ids:
        conn.execute(text("DELETE FROM fcl_rates WHERE rate_card_id = ANY(:ids)"), {"ids": fcl_card_ids})
        logger.info(f"  Cleared existing FCL rates for {len(fcl_card_ids)} cards")
        batch: list[dict] = []
        for rows in fcl_by_card.values():
            batch.extend(rows)
            if len(batch) >= BATCH_SIZE:
                _insert_fcl_rates(conn, batch)
                batch.clear()
        if batch:
            _insert_fcl_rates(conn, batch)

    lcl_card_ids = list(lcl_by_card.keys())
    if lcl_card_ids:
        conn.execute(text("DELETE FROM lcl_rates WHERE rate_card_id = ANY(:ids)"), {"ids": lcl_card_ids})
        logger.info(f"  Cleared existing LCL rates for {len(lcl_card_ids)} cards")
        batch = []
        for rows in lcl_by_card.values():
            batch.extend(rows)
            if len(batch) >= BATCH_SIZE:
                _insert_lcl_rates(conn, batch)
                batch.clear()
        if batch:
            _insert_lcl_rates(conn, batch)

    logger.info(f"  FCL rates inserted: {fcl_total}")
    logger.info(f"  LCL rates inserted: {lcl_total}")


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


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Re-runnable FCL/LCL pricing sync from Datastore")
    parser.add_argument("--dry-run", action="store_true", help="Print counts and origin breakdown only — no DB writes")
    args = parser.parse_args()

    ds_client = datastore.Client()
    get_engine.cache_clear()
    engine = get_engine()
    engine.dispose()

    with engine.connect() as conn:
        fcl_map = sync_fcl_rate_cards(ds_client, conn, args.dry_run)
        lcl_map = sync_lcl_rate_cards(ds_client, conn, args.dry_run)
        sync_rates(ds_client, conn, fcl_map, lcl_map, args.dry_run)

        if not args.dry_run:
            conn.commit()

    prefix = "DRY RUN — " if args.dry_run else ""
    logger.info(f"\n{prefix}Sync complete.")
    logger.info(f"  FCL rate cards in Datastore: {len(fcl_map)}")
    logger.info(f"  LCL rate cards in Datastore: {len(lcl_map)}")


if __name__ == "__main__":
    main()
