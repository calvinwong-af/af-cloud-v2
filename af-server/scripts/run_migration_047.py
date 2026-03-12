"""
scripts/run_migration_047.py — Create currency_rates table

Migration 047:
  - Creates `currency_rates` table with effective_from-based time series
  - Adds lookup index and updated_at trigger

After running this migration, run migrate_currency_rates.py to seed
legacy Datastore CurrencyConversion pairs with effective_from = 2026-01-01.

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_047.py
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
        "migrations", "047_currency_rates.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 047 — Create currency_rates table...")

    conn = psycopg2.connect(dsn)
    try:
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(sql)
        cur.close()
        print("  Migration applied.")
    finally:
        conn.close()

    # Verification
    conn2 = psycopg2.connect(dsn)
    try:
        cur = conn2.cursor()

        cur.execute("SELECT COUNT(*) FROM currency_rates")
        row_count = cur.fetchone()[0]

        cur.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'currency_rates'
            ORDER BY ordinal_position
        """)
        columns = cur.fetchall()

        print(f"  currency_rates rows : {row_count}")
        print(f"  Columns:")
        for col, dtype in columns:
            print(f"    {col:<20} {dtype}")

        cur.close()
    finally:
        conn2.close()

    print("\nDone. Run migrate_currency_rates.py next to seed legacy data.")


if __name__ == "__main__":
    run()
