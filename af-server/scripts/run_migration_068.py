"""
scripts/run_migration_068.py — Flag MYPKG haulage cards as tariff rate cards

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_068.py
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
        "migrations", "068_haulage_pkg_tariff_rate.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 068 — Flag MYPKG haulage cards as tariff rate cards...")

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

        cur.execute("SELECT COUNT(*) FROM haulage_rate_cards WHERE port_un_code = 'MYPKG' AND is_tariff_rate = TRUE")
        count = cur.fetchone()[0]
        print(f"\n  MYPKG cards flagged as tariff rate: {count}")

        cur.execute("SELECT COUNT(*) FROM haulage_rate_cards WHERE is_tariff_rate = FALSE")
        non_tariff = cur.fetchone()[0]
        print(f"  Non-tariff rate cards remaining: {non_tariff}")

        cur.close()
    finally:
        conn2.close()

    print("\nDone.")


if __name__ == "__main__":
    run()
