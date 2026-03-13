"""
scripts/run_migration_056.py — Add is_international to customs_rate_cards

Migration 056:
  - Adds is_international BOOLEAN NOT NULL DEFAULT TRUE to customs_rate_cards
  - Backfills: SET is_international = FALSE WHERE is_domestic = TRUE
  - Rebuilds rate_card_key to 6-part format (adds is_international)
  - Updates UNIQUE constraint on customs_rate_cards to include is_international

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_056.py
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
        "migrations", "056_customs_is_international.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 056 — Add is_international to customs_rate_cards...")

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

        # Column exists
        cur.execute("""
            SELECT column_name, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'customs_rate_cards' AND column_name = 'is_international'
        """)
        col = cur.fetchone()
        print(f"\n  customs_rate_cards.is_international exists: {bool(col)}")
        if col:
            print(f"    default={col[1]}, nullable={col[2]}")

        # Backfill check
        cur.execute("SELECT COUNT(*) FROM customs_rate_cards WHERE is_domestic = TRUE AND is_international = FALSE")
        backfilled = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM customs_rate_cards WHERE is_domestic = TRUE")
        domestic = cur.fetchone()[0]
        print(f"  Domestic cards backfilled to is_international=FALSE: {backfilled}/{domestic}")

        # rate_card_key is 6-part (check a sample)
        cur.execute("SELECT rate_card_key FROM customs_rate_cards LIMIT 3")
        samples = [r[0] for r in cur.fetchall()]
        print(f"  Sample rate_card_keys (expect 6 parts):")
        for s in samples:
            parts = s.split("|")
            print(f"    {s!r}  → {len(parts)} parts {'✓' if len(parts) == 6 else 'WARNING'}")

        # Unique constraint covers is_international
        cur.execute("""
            SELECT indexdef FROM pg_indexes
            WHERE tablename = 'customs_rate_cards' AND indexname = 'customs_rate_cards_unique'
        """)
        idx = cur.fetchone()
        print(f"\n  customs_rate_cards_unique index: {idx[0] if idx else 'NOT FOUND'}")

        cur.close()
    finally:
        conn2.close()

    print("\nDone.")


if __name__ == "__main__":
    run()
