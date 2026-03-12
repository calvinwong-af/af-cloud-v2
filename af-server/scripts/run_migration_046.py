"""
scripts/run_migration_046.py — Create Quotations Table

Migration 046:
  - Creates `quotations` table with scope_snapshot + transport_details JSONB
  - Creates `quotation_ref_seq` sequence for AFQ-XXXXXXXX ref generation
  - Adds updated_at trigger

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_046.py
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
        "migrations", "046_quotations.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 046 — Create Quotations Table...")

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

        cur.execute("SELECT COUNT(*) FROM quotations")
        row_count = cur.fetchone()[0]

        cur.execute("SELECT last_value FROM quotation_ref_seq")
        seq_val = cur.fetchone()[0]

        cur.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'quotations'
            ORDER BY ordinal_position
        """)
        columns = cur.fetchall()

        print(f"  quotations rows     : {row_count}")
        print(f"  quotation_ref_seq   : last_value = {seq_val}")
        print(f"  Columns:")
        for col, dtype in columns:
            print(f"    {col}: {dtype}")
        print("\n  Migration 046 complete.")
        cur.close()
    finally:
        conn2.close()


if __name__ == "__main__":
    run()


