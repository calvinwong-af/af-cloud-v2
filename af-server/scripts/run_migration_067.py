"""
scripts/run_migration_067.py — Move currency from air rate rows to card tables

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_067.py
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
        "migrations", "067_air_card_currency.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 067 — Move currency from air rate rows to card tables...")

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
            WHERE table_name = 'air_freight_rate_cards' AND column_name = 'currency'
        """)
        cols = [r[0] for r in cur.fetchall()]
        print(f"\n  air_freight_rate_cards columns added: {cols}")

        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'air_freight_rates' AND column_name = 'currency'
        """)
        dropped = [r[0] for r in cur.fetchall()]
        print(f"  air_freight_rates currency remaining (should be empty): {dropped}")

        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'air_list_price_rate_cards' AND column_name = 'currency'
        """)
        cols2 = [r[0] for r in cur.fetchall()]
        print(f"  air_list_price_rate_cards columns added: {cols2}")

        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'air_list_price_rates' AND column_name = 'currency'
        """)
        dropped2 = [r[0] for r in cur.fetchall()]
        print(f"  air_list_price_rates currency remaining (should be empty): {dropped2}")

        cur.close()
    finally:
        conn2.close()

    print("\nDone.")


if __name__ == "__main__":
    run()
