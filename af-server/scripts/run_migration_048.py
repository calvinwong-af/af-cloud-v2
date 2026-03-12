"""
scripts/run_migration_048.py — Quotation line items + currency on quotations

Migration 048:
  - Adds `currency` (VARCHAR 3, default MYR) to quotations
  - Adds `scope_changed` (BOOLEAN, default FALSE) to quotations
  - Creates `quotation_line_items` table with price/cost/conversion columns,
    source traceability, manual override flag, and sort order

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_048.py
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
        "migrations", "048_quotation_line_items.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 048 — Quotation line items + currency on quotations...")

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

        # Check new quotations columns
        cur.execute("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'quotations'
              AND column_name IN ('currency', 'scope_changed')
            ORDER BY column_name
        """)
        new_cols = cur.fetchall()
        print("\n  quotations new columns:")
        for col, dtype, default in new_cols:
            print(f"    {col:<20} {dtype:<20} default={default}")

        # Check quotation_line_items table
        cur.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'quotation_line_items'
            ORDER BY ordinal_position
        """)
        columns = cur.fetchall()
        print(f"\n  quotation_line_items columns ({len(columns)}):")
        for col, dtype in columns:
            print(f"    {col:<25} {dtype}")

        # Check indexes
        cur.execute("""
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'quotation_line_items'
            ORDER BY indexname
        """)
        indexes = cur.fetchall()
        print(f"\n  quotation_line_items indexes:")
        for (idx,) in indexes:
            print(f"    {idx}")

        cur.execute("SELECT COUNT(*) FROM quotation_line_items")
        print(f"\n  quotation_line_items rows: {cur.fetchone()[0]}")

        cur.close()
    finally:
        conn2.close()

    print("\nDone.")


if __name__ == "__main__":
    run()
