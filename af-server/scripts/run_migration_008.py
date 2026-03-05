"""
scripts/run_migration_008.py

Run migration 008 — creates ground_transport_orders, ground_transport_legs tables
and adds scope column to shipments.

Usage (from af-server directory, with Cloud SQL Auth Proxy running):
    python scripts/run_migration_008.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

from sqlalchemy import text
from core.db import get_engine


def main():
    print("Running migration 008: Ground transport tables + shipments.scope...")

    migration_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'migrations', '008_ground_transport.sql'
    )
    with open(migration_path, 'r') as f:
        sql = f.read()

    engine = get_engine()
    with engine.connect() as conn:
        for statement in sql.split(';'):
            statement = statement.strip()
            if statement:
                conn.execute(text(statement))
        conn.commit()

        gt_count = conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'ground_transport_orders'"
        )).scalar()
        legs_count = conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'ground_transport_legs'"
        )).scalar()
        scope_exists = conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'scope'"
        )).scalar()

        print(f"Migration 008 complete.")
        print(f"  ground_transport_orders table: {'exists' if gt_count else 'MISSING'}")
        print(f"  ground_transport_legs table: {'exists' if legs_count else 'MISSING'}")
        print(f"  shipments.scope column: {'exists' if scope_exists else 'MISSING'}")


if __name__ == "__main__":
    main()
