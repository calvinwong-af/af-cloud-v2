"""
scripts/run_migration_059.py — Move tlx_release to shipment_details

Migration 059:
  - Adds tlx_release column to shipment_details
  - Backfills from quotations.tlx_release
  - Drops tlx_release from quotations

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_059.py
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
        "migrations", "059_scope_tlx_release.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 059 — Move tlx_release to shipment_details...")

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

        # Check shipment_details has tlx_release
        cur.execute("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'shipment_details' AND column_name = 'tlx_release'
        """)
        col = cur.fetchone()
        print(f"\n  shipment_details.tlx_release exists: {bool(col)}")
        if col:
            print(f"    type={col[1]}, default={col[2]}")

        # Check quotations no longer has tlx_release
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'quotations' AND column_name = 'tlx_release'
        """)
        q_col = cur.fetchone()
        print(f"  quotations.tlx_release removed: {not bool(q_col)}")

        # Count backfilled rows
        cur.execute("SELECT COUNT(*) FROM shipment_details WHERE tlx_release = TRUE")
        count = cur.fetchone()[0]
        print(f"  Shipments with tlx_release=TRUE: {count}")

        cur.close()
    finally:
        conn2.close()

    print("\nDone.")


if __name__ == "__main__":
    run()
