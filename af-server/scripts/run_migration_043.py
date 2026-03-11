"""
scripts/run_migration_043.py — Drop shipment_workflows.company_id

Migration 043:
  - Drops denormalized company_id column from shipment_workflows
  - Column was seeded at record creation and never updated on reassignment
  - get_status_history auth check now JOINs orders instead

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_043.py
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
        "migrations", "043_drop_workflow_company_id.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 043 — DROP shipment_workflows.company_id...")

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

        # Confirm company_id column is gone
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'shipment_workflows'
            ORDER BY ordinal_position
        """)
        cols = [r[0] for r in cur.fetchall()]

        if "company_id" in cols:
            print("  ERROR: company_id column still present!")
        else:
            print("  company_id column: DROPPED OK")

        print(f"\n  shipment_workflows columns ({len(cols)}):")
        for c in cols:
            print(f"    - {c}")

        print("\n  Migration 043 complete.")
        cur.close()
    finally:
        conn2.close()


if __name__ == "__main__":
    run()
