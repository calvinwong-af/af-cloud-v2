"""
scripts/run_migration_013.py — Add scope column to shipment_details.

Migration 013: shipment_details.scope JSONB column was omitted from
migration 011. Required for the Configure Scope feature (v5.07).

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_013.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

from sqlalchemy import text
from core.db import get_engine


def run():
    engine = get_engine()
    with engine.connect() as conn:
        print("Running migration 013 — adding scope column to shipment_details...")
        conn.execute(text(
            "ALTER TABLE shipment_details ADD COLUMN IF NOT EXISTS scope JSONB"
        ))
        conn.commit()
        print("  OK")

        # Verify
        row = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'shipment_details' AND column_name = 'scope'
        """)).fetchone()
        if row:
            print("  Verified: scope column exists on shipment_details.")
        else:
            print("  ERROR: scope column not found after migration!")


if __name__ == "__main__":
    run()
