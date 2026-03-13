"""
scripts/run_migration_050.py — DG class charges table

Migration 050:
  - Creates dg_class_charges table
  - Stores DG-specific port-level charges (DG-2, DG-3 only)
  - No ALL wildcard for dg_class_code — always requires exact match

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_050.py
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
        "migrations", "050_dg_class_charges.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 050 — DG class charges table...")

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

        # Check table exists
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name = 'dg_class_charges'
        """)
        tbl = cur.fetchone()
        print(f"\n  Table exists: {bool(tbl)}")

        # Check constraints
        cur.execute("""
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'dg_class_charges'
            ORDER BY constraint_name
        """)
        print(f"\n  Constraints found:")
        for (c,) in cur.fetchall():
            print(f"    {c}")

        # Check indexes
        cur.execute("""
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'dg_class_charges'
            ORDER BY indexname
        """)
        print(f"\n  Indexes found:")
        for (i,) in cur.fetchall():
            print(f"    {i}")

        # Row count (should be 0)
        cur.execute("SELECT COUNT(*) FROM dg_class_charges")
        count = cur.fetchone()[0]
        print(f"\n  Row count: {count}")

        cur.close()
    finally:
        conn2.close()

    print("\nDone.")


if __name__ == "__main__":
    run()
