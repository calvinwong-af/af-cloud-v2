"""
scripts/run_migration_015.py — Deprecate ports.country, backfill country_code, add FK.

Migration 015:
  - Backfills country_code from UN/LOCODE prefix where NULL
  - Adds FK constraint ports.country_code → countries.country_code
  - Adds deprecation comment on ports.country column

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_015.py
"""

import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

import psycopg2


def _parse_dsn(database_url: str) -> str:
    """Convert SQLAlchemy DATABASE_URL to a psycopg2 DSN string."""
    url = re.sub(r"\+psycopg2", "", database_url)
    return url


def run():
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        print("ERROR: DATABASE_URL not set in .env.local")
        sys.exit(1)

    dsn = _parse_dsn(database_url)

    migration_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "migrations", "015_deprecate_ports_country.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 015 — deprecate ports.country, backfill country_code, add FK...")

    conn = psycopg2.connect(dsn)
    try:
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(sql)
        cur.close()
        print("  Migration applied and committed.")
    finally:
        conn.close()

    # Verification on fresh connection
    conn2 = psycopg2.connect(dsn)
    try:
        cur2 = conn2.cursor()

        # Count ports with NULL country_code (expect 0)
        cur2.execute("SELECT COUNT(*) FROM ports WHERE country_code IS NULL")
        null_count = cur2.fetchone()[0]
        print(f"\n  Ports with NULL country_code: {null_count} (expected: 0)")

        # Total ports
        cur2.execute("SELECT COUNT(*) FROM ports")
        total = cur2.fetchone()[0]
        print(f"  Total ports: {total}")

        # Ports with country_code set
        cur2.execute("SELECT COUNT(*) FROM ports WHERE country_code IS NOT NULL")
        with_cc = cur2.fetchone()[0]
        print(f"  Ports with country_code set: {with_cc}")

        # Check FK constraint exists
        cur2.execute("""
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name = 'ports' AND constraint_type = 'FOREIGN KEY'
              AND constraint_name = 'fk_ports_country_code'
        """)
        fk_row = cur2.fetchone()
        if fk_row:
            print(f"\n  FK constraint confirmed: {fk_row[0]}")
        else:
            print("\n  WARNING: FK constraint fk_ports_country_code not found!")

        # Count how many NULL country_code ports are short IATA codes (3-char)
        cur2.execute("SELECT COUNT(*) FROM ports WHERE country_code IS NULL AND LENGTH(un_code) = 3")
        iata_null = cur2.fetchone()[0]

        if fk_row and null_count == iata_null:
            print(f"\n  Migration 015 complete — all checks passed.")
            if null_count > 0:
                print(f"  ({null_count} IATA airport codes have NULL country_code — expected)")
        else:
            print("\n  WARNING: Some checks did not pass.")

        cur2.close()
    finally:
        conn2.close()


if __name__ == "__main__":
    run()
