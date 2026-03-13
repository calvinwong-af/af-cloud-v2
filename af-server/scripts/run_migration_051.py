"""
scripts/run_migration_051.py — Add is_international flag

Migration 051:
  - Adds is_international BOOLEAN NOT NULL DEFAULT TRUE to local_charges
  - Adds is_international BOOLEAN NOT NULL DEFAULT TRUE to dg_class_charges
  - Backfills: SET is_international = FALSE WHERE is_domestic = TRUE on both tables

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_051.py
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
        "migrations", "051_is_international.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 051 — Add is_international flag...")

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

        # Check column exists on local_charges
        cur.execute("""
            SELECT column_name, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'local_charges' AND column_name = 'is_international'
        """)
        col = cur.fetchone()
        print(f"\n  local_charges.is_international exists: {bool(col)}")
        if col:
            print(f"    default={col[1]}, nullable={col[2]}")

        # Check column exists on dg_class_charges
        cur.execute("""
            SELECT column_name, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'dg_class_charges' AND column_name = 'is_international'
        """)
        col2 = cur.fetchone()
        print(f"\n  dg_class_charges.is_international exists: {bool(col2)}")
        if col2:
            print(f"    default={col2[1]}, nullable={col2[2]}")

        # Check backfill counts
        cur.execute("SELECT COUNT(*) FROM local_charges WHERE is_domestic = TRUE AND is_international = FALSE")
        lc_backfilled = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM local_charges WHERE is_domestic = TRUE")
        lc_domestic = cur.fetchone()[0]
        print(f"\n  local_charges: {lc_backfilled}/{lc_domestic} domestic rows backfilled to is_international=FALSE")

        cur.execute("SELECT COUNT(*) FROM dg_class_charges WHERE is_domestic = TRUE AND is_international = FALSE")
        dg_backfilled = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM dg_class_charges WHERE is_domestic = TRUE")
        dg_domestic = cur.fetchone()[0]
        print(f"  dg_class_charges: {dg_backfilled}/{dg_domestic} domestic rows backfilled to is_international=FALSE")

        cur.close()
    finally:
        conn2.close()

    print("\nDone.")


if __name__ == "__main__":
    run()
