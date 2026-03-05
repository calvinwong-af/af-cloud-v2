"""
scripts/run_migration_006.py

Run migration 006 — creates countries table and seeds global country data.

Usage (from af-server directory, with Cloud SQL Auth Proxy running):
    python scripts/run_migration_006.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

from sqlalchemy import text
from core.db import get_engine

MIGRATION_FILE = os.path.join(os.path.dirname(__file__), '..', 'migrations', '006_countries.sql')


def main():
    print("Running migration 006: countries table...")

    with open(MIGRATION_FILE, 'r') as f:
        sql = f.read()

    engine = get_engine()
    with engine.connect() as conn:
        # Strip SQL comments then split on semicolons
        import re
        cleaned = re.sub(r'--[^\n]*', '', sql)
        statements = [s.strip() for s in cleaned.split(';') if s.strip()]
        for stmt in statements:
            conn.execute(text(stmt))
        conn.commit()

    print("Migration 006 complete.")
    print("  - countries table created")
    print("  - Global country seed data inserted")
    print("  - MY: MYR, SST 6%")
    print("  - SG: SGD, GST 9%")
    print("  - AU: AUD")
    print("  - EU members: EUR")
    print("  - All others: USD")


if __name__ == "__main__":
    main()
