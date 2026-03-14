"""
scripts/run_migration_063.py — Move currency + uom from haulage_rates to haulage_rate_cards

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_063.py
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
        "migrations", "063_haulage_card_currency_uom.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 063 — Move currency + uom to haulage_rate_cards...")

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
            WHERE table_name = 'haulage_rate_cards' AND column_name IN ('currency', 'uom')
            ORDER BY column_name
        """)
        cols = [r[0] for r in cur.fetchall()]
        print(f"\n  haulage_rate_cards new columns: {cols}")

        cur.execute("""
            SELECT COUNT(*) FROM haulage_rate_cards WHERE currency IS NOT NULL AND uom IS NOT NULL
        """)
        row = cur.fetchone()
        print(f"  Cards with currency+uom set: {row[0] if row else 0}")

        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'haulage_rates' AND column_name IN ('currency', 'uom')
        """)
        remaining = [r[0] for r in cur.fetchall()]
        print(f"  haulage_rates still has currency/uom: {remaining if remaining else 'No (dropped)'}")

        cur.close()
    finally:
        conn2.close()

    print("\nDone.")


if __name__ == "__main__":
    run()
