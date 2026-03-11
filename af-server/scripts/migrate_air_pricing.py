"""
scripts/migrate_air_pricing.py

Migrate PricingAir + PTMonthlyRateOceanAir (kind=PT-AIR)
from Google Cloud Datastore to PostgreSQL air_freight_rate_cards + air_freight_rates.

Field mapping:
  PricingAir (Datastore kind)        → air_freight_rate_cards
    port_origin_un_code              → origin_port_code
    port_destination_un_code         → destination_port_code
    dg_class_code                    → dg_class_code
    airline_code                     → airline_code (strip + upper)
    code                             → code (default 'FR-AIR')
    description                      → description (default '')
    trash                            → is_active (inverted)

  PTMonthlyRateOceanAir              → air_freight_rates
    (where kind = 'PT-AIR')
    is_price=True, supplier_id=None  → supplier_id = NULL (list price reference)
    is_price=False                   → supplier_id from entity
    price.l45_price                  → l45_list_price
    price.p45_price                  → p45_list_price
    price.p100_price                 → p100_list_price
    price.p250_price                 → p250_list_price
    price.p300_price                 → p300_list_price
    price.p500_price                 → p500_list_price
    price.p1000_price                → p1000_list_price
    price.min_price                  → min_list_price
    cost.l45_cost                    → l45_cost
    cost.p45_cost                    → p45_cost
    cost.p100_cost                   → p100_cost
    cost.p250_cost                   → p250_cost
    cost.p300_cost                   → p300_cost
    cost.p500_cost                   → p500_cost
    cost.p1000_cost                  → p1000_cost
    cost.min_cost                    → min_cost
    charges.fsc                      → surcharges JSONB ("fsc", "Fuel Surcharge")
    charges.msc                      → surcharges JSONB ("msc", "Misc Surcharge")
    charges.ssc                      → surcharges JSONB ("ssc", "Security Surcharge")
    month_year (JAN-2025)            → effective_from (first of month)
    currency                         → currency

Filters:
  - Date cutoff: only migrate rate rows where effective_from >= 2024-01-01
  - Trash filter: skip PricingAir entities where trash = True
  - UOM filter: skip rows where uom = "CTR" (34 legacy rows, single card)
  - Supplier validation: skip cost rows where supplier_id not in companies table

Run from af-server root with Cloud SQL Auth Proxy running and venv active:
    .venv\\Scripts\\python scripts\\migrate_air_pricing.py --dry-run
    .venv\\Scripts\\python scripts\\migrate_air_pricing.py
"""

import argparse
import json
import logging
import os
import sys
from collections import defaultdict
from datetime import date, timedelta

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

from google.cloud import datastore
from google.cloud.datastore.query import PropertyFilter

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

PROJECT_ID = 'cloud-accele-freight'
KIND_PRICING_AIR = 'PricingAir'
KIND_MONTHLY_RATE = 'PTMonthlyRateOceanAir'
PT_AIR = 'PT-AIR'
CUTOFF_DATE = date(2024, 1, 1)
BATCH_SIZE = 500

_MONTH_MAP = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


def _get_pg_conn():
    """Get a psycopg2 connection from DATABASE_URL in .env.local."""
    db_url = os.environ.get("DATABASE_URL", "")
    # Strip SQLAlchemy prefix if present
    dsn = db_url.replace("postgresql+psycopg2://", "postgresql://")
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    return conn


def load_valid_company_ids(cur) -> set[str]:
    """Load all company IDs from the companies table."""
    cur.execute("SELECT id FROM companies")
    return {r[0] for r in cur.fetchall()}


# ---------------------------------------------------------------------------
# Step 2: Migrate PricingAir → air_freight_rate_cards
# ---------------------------------------------------------------------------

def migrate_rate_cards(
    ds_client,
    cur,
    dry_run: bool,
) -> dict[str, int]:
    """
    Migrate PricingAir → air_freight_rate_cards.
    Returns card_map: {datastore_pt_id_string: air_freight_rate_cards.id}
    """
    logger.info("\n=== Step 2: Air Freight Rate Cards (PricingAir) ===")

    query = ds_client.query(kind=KIND_PRICING_AIR)
    entities = list(query.fetch())
    logger.info(f"  Fetched {len(entities)} PricingAir entities from Datastore")

    card_map: dict[str, int] = {}
    migrated = 0
    skipped_trash = 0
    skipped_no_ptid = 0
    port_counts: dict[str, int] = defaultdict(int)

    for e in entities:
        pt_id = e.get("pt_id") or (e.key.name if e.key.name else None)
        if not pt_id:
            skipped_no_ptid += 1
            logger.warning("  WARN: PricingAir entity with no pt_id, skipping")
            continue

        pt_id = str(pt_id).strip()

        if e.get("trash", False):
            skipped_trash += 1
            continue

        origin = (e.get("port_origin_un_code") or "").strip().upper()
        dest = (e.get("port_destination_un_code") or "").strip().upper()
        dg_class = (e.get("dg_class_code") or "").strip().upper()
        airline = (e.get("airline_code") or "").strip().upper()
        code = (e.get("code") or "FR-AIR").strip()
        description = (e.get("description") or "").strip()

        rate_card_key = f"{origin}:{dest}:{dg_class}:{airline}"

        port_counts[origin] = port_counts.get(origin, 0) + 1

        if dry_run:
            migrated += 1
            card_map[pt_id] = -1
            continue

        cur.execute("""
            INSERT INTO air_freight_rate_cards
                (rate_card_key, origin_port_code, destination_port_code,
                 dg_class_code, airline_code, code, description, is_active)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, TRUE)
            ON CONFLICT (rate_card_key) DO NOTHING
            RETURNING id
        """, (rate_card_key, origin, dest, dg_class, airline, code, description))

        row = cur.fetchone()
        if row:
            card_map[pt_id] = row[0]
            migrated += 1
        else:
            cur.execute(
                "SELECT id FROM air_freight_rate_cards WHERE rate_card_key = %s",
                (rate_card_key,)
            )
            existing = cur.fetchone()
            if existing:
                card_map[pt_id] = existing[0]

    logger.info(f"  Migrated: {migrated}")
    logger.info(f"  Skipped (trashed): {skipped_trash}")
    logger.info(f"  Skipped (no pt_id): {skipped_no_ptid}")
    logger.info(f"  Card map size: {len(card_map)}")
    logger.info(f"  Breakdown by origin port:")
    for port in sorted(port_counts.keys()):
        logger.info(f"    {port}: {port_counts[port]}")

    return card_map


# ---------------------------------------------------------------------------
# Step 3: Migrate PTMonthlyRateOceanAir → air_freight_rates
# ---------------------------------------------------------------------------

def migrate_rates(
    ds_client,
    cur,
    card_map: dict[str, int],
    valid_company_ids: set[str],
    dry_run: bool,
):
    """
    Fetch PTMonthlyRateOceanAir (kind=PT-AIR) → air_freight_rates.
    """
    logger.info("\n=== Step 3: Air Freight Rates (PTMonthlyRateOceanAir) ===")

    query = ds_client.query(kind=KIND_MONTHLY_RATE)
    query.add_filter(filter=PropertyFilter("kind", "=", PT_AIR))
    entities = list(query.fetch())
    logger.info(f"  Fetched {len(entities)} PT-AIR rate entities from Datastore")

    grouped: dict[tuple[int, str | None], list[dict]] = defaultdict(list)

    skipped_ctr = 0
    skipped_old = 0
    skipped_no_card = 0
    skipped_supplier_invalid = 0
    parse_errors = 0
    count_list_price = 0
    count_supplier = 0

    for e in entities:
        uom = (e.get("uom") or "").strip().upper()
        if uom == "CTR":
            skipped_ctr += 1
            continue

        month_year = e.get("month_year", "")
        effective_from = _parse_month_year(month_year)

        if not effective_from:
            parse_errors += 1
            continue

        if effective_from < CUTOFF_DATE:
            skipped_old += 1
            continue

        pt_id = str(e.get("pt_id", "")).strip()
        if not pt_id or pt_id not in card_map:
            skipped_no_card += 1
            continue

        db_card_id = card_map[pt_id]
        if db_card_id == -1:
            db_card_id = hash(pt_id) & 0x7FFFFFFF  # dry run surrogate

        is_price = bool(e.get("is_price", False))
        raw_supplier_id = None if is_price else (e.get("supplier_id") or None)

        # Validate supplier_id against companies table
        supplier_id = None
        if raw_supplier_id is not None:
            if raw_supplier_id not in valid_company_ids:
                logger.warning(f"  WARN: supplier_id {raw_supplier_id!r} not found in companies — skipping rate row")
                skipped_supplier_invalid += 1
                continue
            supplier_id = raw_supplier_id

        if is_price:
            count_list_price += 1
        else:
            count_supplier += 1

        price_data = e.get("price") or {}
        cost_data = e.get("cost") or {}
        charges_data = e.get("charges") or {}

        # Surcharges → JSONB
        surcharges = []
        for code_key, label in [("fsc", "Fuel Surcharge"), ("msc", "Misc Surcharge"), ("ssc", "Security Surcharge")]:
            val = _safe_float(charges_data.get(code_key))
            if val is not None and val > 0:
                surcharges.append({"code": code_key, "amount": val})

        grouped[(db_card_id, supplier_id)].append({
            "rate_card_id": db_card_id,
            "supplier_id": supplier_id,
            "effective_from": effective_from,
            "currency": (e.get("currency") or "").strip(),
            "rate_status": "PUBLISHED",
            # List price breakpoints
            "l45_list_price": _safe_float(price_data.get("l45_price")) if is_price else None,
            "p45_list_price": _safe_float(price_data.get("p45_price")) if is_price else None,
            "p100_list_price": _safe_float(price_data.get("p100_price")) if is_price else None,
            "p250_list_price": _safe_float(price_data.get("p250_price")) if is_price else None,
            "p300_list_price": _safe_float(price_data.get("p300_price")) if is_price else None,
            "p500_list_price": _safe_float(price_data.get("p500_price")) if is_price else None,
            "p1000_list_price": _safe_float(price_data.get("p1000_price")) if is_price else None,
            "min_list_price": _safe_float(price_data.get("min_price")) if is_price else None,
            # Cost breakpoints
            "l45_cost": _safe_float(cost_data.get("l45_cost")) if not is_price else None,
            "p45_cost": _safe_float(cost_data.get("p45_cost")) if not is_price else None,
            "p100_cost": _safe_float(cost_data.get("p100_cost")) if not is_price else None,
            "p250_cost": _safe_float(cost_data.get("p250_cost")) if not is_price else None,
            "p300_cost": _safe_float(cost_data.get("p300_cost")) if not is_price else None,
            "p500_cost": _safe_float(cost_data.get("p500_cost")) if not is_price else None,
            "p1000_cost": _safe_float(cost_data.get("p1000_cost")) if not is_price else None,
            "min_cost": _safe_float(cost_data.get("min_cost")) if not is_price else None,
            # Surcharges
            "surcharges": surcharges if surcharges else None,
        })

    logger.info(f"  Skipped (CTR uom): {skipped_ctr}")
    logger.info(f"  Skipped (pre-{CUTOFF_DATE.year}): {skipped_old}")
    logger.info(f"  Skipped (no matching rate card): {skipped_no_card}")
    logger.info(f"  Skipped (supplier not in companies): {skipped_supplier_invalid}")
    logger.info(f"  Parse errors: {parse_errors}")
    logger.info(f"  Groups (card+supplier combos): {len(grouped)}")
    logger.info(f"  List price rows: {count_list_price}")
    logger.info(f"  Supplier cost rows: {count_supplier}")

    total_rows = sum(len(v) for v in grouped.values())

    if dry_run:
        logger.info(f"  [DRY RUN] Would insert {total_rows} air_freight_rates rows")
        return

    # Insert with date range closing
    batch: list[tuple] = []
    total_inserted = 0

    for (db_card_id, supplier_id), rows in grouped.items():
        rows.sort(key=lambda r: r["effective_from"])

        for i, row in enumerate(rows):
            if i < len(rows) - 1:
                effective_to = rows[i + 1]["effective_from"] - timedelta(days=1)
            else:
                effective_to = None

            batch.append((
                row["rate_card_id"],
                row["supplier_id"],
                row["effective_from"],
                effective_to,
                row["rate_status"],
                row["currency"],
                row["l45_list_price"],
                row["p45_list_price"],
                row["p100_list_price"],
                row["p250_list_price"],
                row["p300_list_price"],
                row["p500_list_price"],
                row["p1000_list_price"],
                row["min_list_price"],
                row["l45_cost"],
                row["p45_cost"],
                row["p100_cost"],
                row["p250_cost"],
                row["p300_cost"],
                row["p500_cost"],
                row["p1000_cost"],
                row["min_cost"],
                json.dumps(row["surcharges"]) if row["surcharges"] else None,
            ))
            total_inserted += 1

            if len(batch) >= BATCH_SIZE:
                _insert_rates(cur, batch)
                batch.clear()

    if batch:
        _insert_rates(cur, batch)

    logger.info(f"  air_freight_rates rows inserted: {total_inserted}")


def _insert_rates(cur, batch: list[tuple]):
    psycopg2.extras.execute_batch(cur, """
        INSERT INTO air_freight_rates
            (rate_card_id, supplier_id, effective_from, effective_to,
             rate_status, currency,
             l45_list_price, p45_list_price, p100_list_price, p250_list_price,
             p300_list_price, p500_list_price, p1000_list_price, min_list_price,
             l45_cost, p45_cost, p100_cost, p250_cost,
             p300_cost, p500_cost, p1000_cost, min_cost,
             surcharges)
        VALUES
            (%s, %s, %s, %s,
             %s, %s,
             %s, %s, %s, %s,
             %s, %s, %s, %s,
             %s, %s, %s, %s,
             %s, %s, %s, %s,
             CAST(%s AS jsonb))
    """, batch)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Migrate PricingAir from Datastore to PostgreSQL"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Print counts only — no DB writes")
    args = parser.parse_args()

    key_file = os.path.join(os.path.dirname(__file__), '..', 'cloud-accele-freight-key.json')
    if os.path.exists(key_file):
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.abspath(key_file)

    ds_client = datastore.Client(project=PROJECT_ID)
    conn = _get_pg_conn()
    cur = conn.cursor()

    try:
        # Step 1: Load reference data from PostgreSQL
        logger.info("\n=== Step 1: Loading reference data from PostgreSQL ===")
        valid_company_ids = load_valid_company_ids(cur)
        logger.info(f"  Companies loaded: {len(valid_company_ids)}")

        # Step 2: Rate cards
        card_map = migrate_rate_cards(ds_client, cur, args.dry_run)

        # Step 3: Rates
        migrate_rates(ds_client, cur, card_map, valid_company_ids, args.dry_run)

    finally:
        cur.close()
        conn.close()

    prefix = "[DRY RUN] " if args.dry_run else ""
    logger.info(f"\n{prefix}Migration complete.")
    logger.info(f"  Rate cards mapped: {len(card_map)}")


if __name__ == "__main__":
    main()
