"""
scripts/run_migration_066.py — Move currency + uom from lcl_rates to lcl_rate_cards

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_066.py
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
        "migrations", "066_lcl_card_currency_uom.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 066 — Move currency + uom from lcl_rates to lcl_rate_cards...")

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
            WHERE table_name = 'lcl_rate_cards' AND column_name IN ('currency', 'uom')
        """)
        cols = [r[0] for r in cur.fetchall()]
        print(f"\n  lcl_rate_cards columns added: {cols}")

        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'lcl_rates' AND column_name IN ('currency', 'uom')
        """)
        dropped = [r[0] for r in cur.fetchall()]
        print(f"  lcl_rates columns remaining (should be empty): {dropped}")

        cur.execute("""
            SELECT COUNT(*) FROM lcl_rate_cards WHERE uom = 'W/M'
        """)
        row = cur.fetchone()
        print(f"  Cards with uom=W/M: {row[0] if row else 0}")

        cur.close()
    finally:
        conn2.close()

    print("\nDone.")


if __name__ == "__main__":
    run()
