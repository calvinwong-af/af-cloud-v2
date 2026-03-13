"""
scripts/run_migration_055.py — Customs two-tier schema split

Migration 055:
  - Creates customs_rate_cards table (card identity)
  - Backfills customs_rate_cards from existing customs_rates data
  - Adds rate_card_id FK to customs_rates
  - Populates rate_card_id on all existing rows
  - Makes rate_card_id NOT NULL, adds indexes
  - Drops card-identity columns from customs_rates
  - Replaces unique constraint with UNIQUE(rate_card_id, effective_from)

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_055.py
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
        "migrations", "055_customs_two_tier.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 055 — Customs two-tier schema split...")

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

        cur.execute("SELECT COUNT(*) FROM customs_rate_cards")
        card_count = cur.fetchone()[0]
        print(f"\n  customs_rate_cards: {card_count} card(s)")

        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'customs_rates'
            ORDER BY ordinal_position
        """)
        cols = [r[0] for r in cur.fetchall()]
        print(f"  customs_rates columns: {cols}")

        dropped = [c for c in ("port_code", "trade_direction", "shipment_type",
                               "charge_code", "description", "currency", "uom", "is_domestic")
                   if c in cols]
        if dropped:
            print(f"  WARNING: card-identity columns still present: {dropped}")
        else:
            print("  Card-identity columns confirmed dropped.")

        cur.execute("SELECT COUNT(*) FROM customs_rates WHERE rate_card_id IS NULL")
        nulls = cur.fetchone()[0]
        print(f"  customs_rates rows with NULL rate_card_id: {nulls} (expect 0)")

        cur.execute("SELECT COUNT(*) FROM customs_rates")
        rate_count = cur.fetchone()[0]
        print(f"  customs_rates: {rate_count} rate row(s)")

        cur.close()
    finally:
        conn2.close()

    print("\nDone.")


if __name__ == "__main__":
    run()
