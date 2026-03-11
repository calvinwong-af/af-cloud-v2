"""
scripts/run_migration_040.py — Air Freight Pricing schema.

Migration 040:
  - Creates air_freight_rate_cards table
  - Creates air_freight_rates table (with breakpoint columns + surcharges JSONB)
  - Hard FK: air_freight_rates.supplier_id → companies(id) ON DELETE RESTRICT

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_040.py
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
        "migrations", "040_air_freight_pricing.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 040 — air_freight_rate_cards + air_freight_rates...")

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

        # Confirm tables exist
        for table in ["air_freight_rate_cards", "air_freight_rates"]:
            cur.execute("""
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = %s
            """, (table,))
            exists = cur.fetchone()[0] == 1
            print(f"  {table}: {'OK' if exists else 'MISSING!'}")

        # Confirm breakpoint columns on air_freight_rates
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'air_freight_rates'
            ORDER BY ordinal_position
        """)
        cols = [r[0] for r in cur.fetchall()]
        print(f"\n  air_freight_rates columns ({len(cols)}):")
        for c in cols:
            print(f"    - {c}")

        # Confirm FK to companies exists
        cur.execute("""
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name = 'air_freight_rates'
              AND constraint_type = 'FOREIGN KEY'
        """)
        fks = [r[0] for r in cur.fetchall()]
        print(f"\n  Foreign key constraints: {fks}")

        # Confirm indexes
        cur.execute("""
            SELECT indexname FROM pg_indexes
            WHERE tablename IN ('air_freight_rate_cards', 'air_freight_rates')
            ORDER BY tablename, indexname
        """)
        indexes = [r[0] for r in cur.fetchall()]
        print(f"\n  Indexes ({len(indexes)}):")
        for idx in indexes:
            print(f"    - {idx}")

        print("\n  Migration 040 complete.")
        cur.close()
    finally:
        conn2.close()


if __name__ == "__main__":
    run()
