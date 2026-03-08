"""
scripts/run_migration_018.py — Add surcharges JSONB to fcl_rates + lcl_rates.

Migration 018:
  - Adds surcharges JSONB column (nullable) to fcl_rates and lcl_rates
  - Migrates any non-zero legacy flat surcharge values (lss, baf, ecrs, psc)
    into the new JSONB array format
  - Legacy flat columns are retained but deprecated

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_018.py
"""

import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

import psycopg2


def _parse_dsn(database_url: str) -> str:
    """Convert SQLAlchemy DATABASE_URL to a psycopg2 DSN string."""
    url = re.sub(r"\+psycopg2", "", database_url)
    return url


def run():
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        print("ERROR: DATABASE_URL not set in .env.local")
        sys.exit(1)

    dsn = _parse_dsn(database_url)

    migration_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "migrations", "018_surcharges_jsonb.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 018 — add surcharges JSONB to fcl_rates + lcl_rates...")

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
        cur2 = conn2.cursor()

        # Confirm column exists on fcl_rates
        cur2.execute("""
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_name = 'fcl_rates' AND column_name = 'surcharges'
        """)
        fcl_col = cur2.fetchone()
        print(f"\n  fcl_rates.surcharges column: {'OK (' + fcl_col[1] + ')' if fcl_col else 'MISSING!'}")

        # Confirm column exists on lcl_rates
        cur2.execute("""
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_name = 'lcl_rates' AND column_name = 'surcharges'
        """)
        lcl_col = cur2.fetchone()
        print(f"  lcl_rates.surcharges column: {'OK (' + lcl_col[1] + ')' if lcl_col else 'MISSING!'}")

        # Count migrated rows
        cur2.execute("SELECT COUNT(*) FROM fcl_rates WHERE surcharges IS NOT NULL")
        fcl_migrated = cur2.fetchone()[0]
        print(f"\n  FCL rates with surcharges migrated: {fcl_migrated}")

        cur2.execute("SELECT COUNT(*) FROM lcl_rates WHERE surcharges IS NOT NULL")
        lcl_migrated = cur2.fetchone()[0]
        print(f"  LCL rates with surcharges migrated: {lcl_migrated}")

        # Check for any non-zero flat columns not yet migrated (sanity check)
        cur2.execute("""
            SELECT COUNT(*) FROM fcl_rates
            WHERE surcharges IS NULL
              AND (lss <> 0 OR baf <> 0 OR ecrs <> 0 OR psc <> 0)
        """)
        fcl_unmigrated = cur2.fetchone()[0]
        if fcl_unmigrated:
            print(f"\n  WARNING: {fcl_unmigrated} FCL rows have non-zero flat surcharges but NULL surcharges JSONB!")
        else:
            print(f"  No unmigrated FCL flat surcharge values — OK.")

        cur2.execute("""
            SELECT COUNT(*) FROM lcl_rates
            WHERE surcharges IS NULL
              AND (lss <> 0 OR baf <> 0 OR ecrs <> 0 OR psc <> 0)
        """)
        lcl_unmigrated = cur2.fetchone()[0]
        if lcl_unmigrated:
            print(f"  WARNING: {lcl_unmigrated} LCL rows have non-zero flat surcharges but NULL surcharges JSONB!")
        else:
            print(f"  No unmigrated LCL flat surcharge values — OK.")

        print(f"\n  Migration 018 complete.")
        cur2.close()
    finally:
        conn2.close()


if __name__ == "__main__":
    run()
