"""
scripts/run_migration_049.py — Local charges: dg_class_code dimension

Migration 049:
  - Adds `dg_class_code` (VARCHAR 10, NOT NULL DEFAULT 'NON-DG') to local_charges
  - Adds CHECK constraint: NON-DG, DG-2, DG-3, ALL
  - Backfills non-THC rows to 'ALL'; LC-THC rows remain 'NON-DG'
  - Drops and recreates lc_unique constraint to include dg_class_code

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_049.py
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
        "migrations", "049_local_charges_dg.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 049 — Local charges: dg_class_code dimension...")

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

        # Check column exists
        cur.execute("""
            SELECT column_name, data_type, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'local_charges'
              AND column_name = 'dg_class_code'
        """)
        col = cur.fetchone()
        if col:
            print(f"\n  local_charges.dg_class_code: {col[1]}, default={col[2]}, nullable={col[3]}")
        else:
            print("\n  ERROR: dg_class_code column not found!")

        # Check constraint exists
        cur.execute("""
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'local_charges'
              AND constraint_name IN ('lc_dg_class_check', 'lc_unique')
            ORDER BY constraint_name
        """)
        constraints = cur.fetchall()
        print(f"\n  Constraints found:")
        for (c,) in constraints:
            print(f"    {c}")

        # Check backfill
        cur.execute("""
            SELECT dg_class_code, COUNT(*)
            FROM local_charges
            GROUP BY dg_class_code
            ORDER BY dg_class_code
        """)
        print(f"\n  dg_class_code distribution:")
        for dg, count in cur.fetchall():
            print(f"    {dg:<10} {count} rows")

        # Spot-check THC rows
        cur.execute("""
            SELECT DISTINCT dg_class_code
            FROM local_charges
            WHERE charge_code = 'LC-THC'
        """)
        thc_codes = [r[0] for r in cur.fetchall()]
        print(f"\n  LC-THC dg_class_code values: {thc_codes}")

        cur.close()
    finally:
        conn2.close()

    print("\nDone.")


if __name__ == "__main__":
    run()
