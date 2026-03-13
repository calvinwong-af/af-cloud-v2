"""
scripts/run_migration_058.py — DG class charges two-tier schema split

Migration 058:
  - Creates dg_class_charge_cards table (card identity)
  - Backfills dg_class_charge_cards from existing dg_class_charges data
  - Adds rate_card_id FK to dg_class_charges
  - Populates rate_card_id on all existing rows
  - Makes rate_card_id NOT NULL, adds indexes
  - Drops card-identity columns + is_active from dg_class_charges
  - Replaces unique constraint with UNIQUE(rate_card_id, effective_from)

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_058.py
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
        "migrations", "058_dg_class_charges_two_tier.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 058 — DG class charges two-tier schema split...")

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

        cur.execute("SELECT COUNT(*) FROM dg_class_charge_cards")
        card_count = cur.fetchone()[0]
        print(f"\n  dg_class_charge_cards: {card_count} card(s)")

        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'dg_class_charges'
            ORDER BY ordinal_position
        """)
        cols = [r[0] for r in cur.fetchall()]
        print(f"  dg_class_charges columns: {cols}")

        dropped = [c for c in ("port_code", "trade_direction", "shipment_type", "dg_class_code",
                               "container_size", "container_type", "charge_code", "description",
                               "currency", "uom", "is_domestic", "is_international", "is_active")
                   if c in cols]
        if dropped:
            print(f"  WARNING: columns still present that should be dropped: {dropped}")
        else:
            print("  All expected columns confirmed dropped.")

        cur.execute("SELECT COUNT(*) FROM dg_class_charges WHERE rate_card_id IS NULL")
        nulls = cur.fetchone()[0]
        print(f"  dg_class_charges rows with NULL rate_card_id: {nulls} (expect 0)")

        cur.execute("SELECT COUNT(*) FROM dg_class_charges")
        rate_count = cur.fetchone()[0]
        print(f"  dg_class_charges: {rate_count} rate row(s)")

        # Sample rate_card_keys (9-part)
        cur.execute("SELECT rate_card_key FROM dg_class_charge_cards LIMIT 3")
        samples = [r[0] for r in cur.fetchall()]
        print(f"  Sample rate_card_keys (expect 9 parts):")
        for s in samples:
            parts = s.split("|")
            print(f"    {s!r}  → {len(parts)} parts {'✓' if len(parts) == 9 else 'WARNING'}")

        cur.close()
    finally:
        conn2.close()

    print("\nDone.")


if __name__ == "__main__":
    run()
