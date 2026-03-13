"""
scripts/run_migration_061.py — Remove scope_transport and transport_details

Migration 061:
  - Drops scope_transport from shipment_details
  - Drops transport_details from quotations

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_061.py
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
        "migrations", "061_cleanup_scope_area.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 061 — Remove scope_transport and transport_details...")

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
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'shipment_details' AND column_name = 'scope_transport'
        """)
        print(f"\n  shipment_details.scope_transport removed: {not bool(cur.fetchone())}")

        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'quotations' AND column_name = 'transport_details'
        """)
        print(f"  quotations.transport_details removed: {not bool(cur.fetchone())}")

        cur.close()
    finally:
        conn2.close()

    print("\nDone.")


if __name__ == "__main__":
    run()
