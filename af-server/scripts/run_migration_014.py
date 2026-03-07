"""
scripts/run_migration_014.py — Port terminals table + terminal_id on rate cards.

Migration 014:
  - Creates port_terminals table
  - Seeds from ports.terminals JSONB (idempotent via ON CONFLICT DO NOTHING)
  - Adds terminal_id column to fcl_rate_cards and lcl_rate_cards
  - Adds indexes

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_014.py
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
    # Strip driver prefix: postgresql+psycopg2:// → postgresql://
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
        "migrations", "014_port_terminals.sql",
    )
    with open(migration_path) as f:
        sql = f.read()

    print("Running migration 014 — port terminals + terminal_id on rate cards...")

    # Use a direct psycopg2 connection — completely bypasses SQLAlchemy
    # and its connection pool / autobegin transaction management.
    conn = psycopg2.connect(dsn)
    try:
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(sql)
        cur.close()
        print("  Migration applied and committed.")
    finally:
        conn.close()

    # Open a fresh independent connection for verification
    conn2 = psycopg2.connect(dsn)
    try:
        cur2 = conn2.cursor()

        # Verify: count port_terminals
        cur2.execute("SELECT COUNT(*) FROM port_terminals")
        print(f"\n  port_terminals rows: {cur2.fetchone()[0]}")

        # Verify: MYPKG terminals
        cur2.execute(
            "SELECT terminal_id, name, is_default FROM port_terminals WHERE port_un_code = 'MYPKG' ORDER BY terminal_id"
        )
        rows = cur2.fetchall()
        if rows:
            print(f"  MYPKG terminals: {len(rows)}")
            for r in rows:
                print(f"    {r[0]} — {r[1]} (default={r[2]})")
        else:
            print("  MYPKG terminals: none found")

        # Verify: terminal_id column exists on rate card tables
        cur2.execute("""
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_name IN ('fcl_rate_cards', 'lcl_rate_cards')
              AND column_name = 'terminal_id'
            ORDER BY table_name
        """)
        col_rows = cur2.fetchall()
        print(f"\n  terminal_id column found on: {[r[0] for r in col_rows]}")

        if len(col_rows) == 2:
            print("\n  Migration 014 complete — all checks passed.")
        else:
            print("\n  WARNING: terminal_id column missing from one or both rate card tables!")

        # Print all seeded terminals
        cur2.execute(
            "SELECT terminal_id, port_un_code, name, is_default FROM port_terminals ORDER BY port_un_code, terminal_id"
        )
        all_terminals = cur2.fetchall()
        if all_terminals:
            print(f"\n  All seeded terminals ({len(all_terminals)}):")
            for t in all_terminals:
                print(f"    {t[1]} / {t[0]} — {t[2]} (default={t[3]})")

        cur2.close()
    finally:
        conn2.close()


if __name__ == "__main__":
    run()
