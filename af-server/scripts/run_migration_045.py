"""
scripts/run_migration_045.py — Migrate Air List Price Data

Migration 045:
  - Populates air_list_price_rate_cards from air_freight_rate_cards (one per O/D+DG)
  - Copies supplier_id IS NULL rows from air_freight_rates into air_list_price_rates
  - Deduplicates by (lp_card, effective_from) — highest p100 wins
  - Original supplier_id IS NULL rows in air_freight_rates are left intact for now

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_045.py
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

import psycopg2


def _parse_dsn(database_url: str) -> str:
    """Strip SQLAlchemy driver prefix for psycopg2."""
    return re.sub(r"\+psycopg2", "", database_url)


def run():
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        print("ERROR: DATABASE_URL not set in .env.local")
        sys.exit(1)

    dsn = _parse_dsn(database_url)

    migration_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "migrations", "045_migrate_air_list_price_data.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 045 — Migrate Air List Price Data...")

    conn = psycopg2.connect(dsn)
    try:
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(sql)
        cur.close()
        print("  Migration applied.")
    finally:
        conn.close()

    # Verification on fresh connection
    conn2 = psycopg2.connect(dsn)
    try:
        cur = conn2.cursor()

        cur.execute("SELECT COUNT(*) FROM air_list_price_rate_cards")
        lp_cards = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM air_list_price_rates")
        lp_rates = cur.fetchone()[0]

        cur.execute("SELECT COUNT(DISTINCT origin_port_code || ':' || destination_port_code || ':' || dg_class_code) FROM air_freight_rate_cards")
        src_distinct = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM air_freight_rates WHERE supplier_id IS NULL")
        src_null = cur.fetchone()[0]

        print(f"  air_list_price_rate_cards rows : {lp_cards}  (source distinct O/D+DG: {src_distinct})")
        print(f"  air_list_price_rates rows      : {lp_rates}  (source supplier IS NULL: {src_null} rows)")
        print(f"  Deduplication removed          : {src_null - lp_rates} rows")
        print("\n  Migration 045 complete.")
        cur.close()
    finally:
        conn2.close()


if __name__ == "__main__":
    run()
