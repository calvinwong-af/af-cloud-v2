"""
scripts/run_migration_044.py — Air List Price Rate Cards

Migration 044:
  - Creates air_list_price_rate_cards table (one record per O/D+DG combination)
  - Creates air_list_price_rates table (time-series list price rows)
  - Decouples list price from per-airline air_freight_rate_cards

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_044.py
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
        "migrations", "044_air_list_price_cards.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 044 — Air List Price Rate Cards...")

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

        print(f"  air_list_price_rate_cards rows : {lp_cards}")
        print(f"  air_list_price_rates rows      : {lp_rates}")
        print("\n  Migration 044 complete.")
        cur.close()
    finally:
        conn2.close()


if __name__ == "__main__":
    run()
