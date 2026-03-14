"""
scripts/run_migration_062.py — currency_rate_pairs + fx_snapshot

Migration 062:
  - Creates currency_rate_pairs table (pair-level metadata)
  - Seeds existing pairs from currency_rates
  - Adds fx_snapshot JSONB column to quotations

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_062.py
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

import psycopg2


def _parse_dsn(database_url: str) -> str:
    return re.sub(r"\+psycopg2", "", database_url)


def run():
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        print("ERROR: DATABASE_URL not set in .env.local")
        sys.exit(1)

    dsn = _parse_dsn(database_url)

    migration_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "migrations", "062_currency_pairs.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 062 — currency_rate_pairs + fx_snapshot...")

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

        cur.execute("""
            SELECT COUNT(*) FROM currency_rate_pairs
        """)
        row = cur.fetchone()
        print(f"\n  currency_rate_pairs rows seeded: {row[0] if row else 0}")

        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'quotations' AND column_name = 'fx_snapshot'
        """)
        print(f"  quotations.fx_snapshot exists: {bool(cur.fetchone())}")

        cur.close()
    finally:
        conn2.close()

    print("\nDone.")


if __name__ == "__main__":
    run()
