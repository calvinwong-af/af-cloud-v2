"""
scripts/fix_effective_to.py

For air_freight_rates and haulage_rates, clear effective_to on rows where:
  - effective_to IS NOT NULL (row was closed by the migration)
  - A newer row exists in the same (rate_card_id, supplier_id) group

These rows had their effective_to set by the migration to form a continuous
monthly chain. Now that duplicate intermediate rows have been deleted, the
oldest row in each group must be open-ended so carry-forward works correctly.
The newer row's effective_from already marks the transition point.

DRY_RUN = True by default.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env.local")
    sys.exit(1)

if DATABASE_URL.startswith("postgresql+psycopg2://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://", 1)

# ---------------------------------------------------------------------------
DRY_RUN = False   # Set to False to execute updates
# ---------------------------------------------------------------------------

FIND_SQL = """
    SELECT r.id
    FROM {table} r
    WHERE r.effective_to IS NOT NULL
      AND EXISTS (
          SELECT 1 FROM {table} r2
          WHERE r2.rate_card_id = r.rate_card_id
            AND r2.supplier_id IS NOT DISTINCT FROM r.supplier_id
            AND r2.effective_from > r.effective_from
      )
"""

UPDATE_SQL = """
    UPDATE {table}
    SET effective_to = NULL, updated_at = NOW()
    WHERE id = ANY(%s)
"""


def _process_table(cur, table: str) -> int:
    print(f"\n[{table}] Scanning for rows with migration-stamped effective_to...")

    cur.execute(FIND_SQL.format(table=table))
    ids = [row[0] for row in cur.fetchall()]
    count = len(ids)

    print(f"  Rows to clear: {count}")
    if count > 0:
        print(f"  Sample IDs:    {ids[:10]}")

    if DRY_RUN:
        print(f"  --> DRY RUN: would clear effective_to on {count} rows")
    else:
        if count > 0:
            cur.execute(UPDATE_SQL.format(table=table), (ids,))
            print(f"  --> Cleared effective_to on {count} rows")
        else:
            print(f"  --> Nothing to update")

    return count


def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    total = 0

    try:
        total += _process_table(cur, "air_freight_rates")
    except Exception as e:
        print(f"\n[air_freight_rates] ERROR: {e}")

    try:
        total += _process_table(cur, "haulage_rates")
    except Exception as e:
        print(f"\n[haulage_rates] ERROR: {e}")

    cur.close()
    conn.close()

    print()
    if DRY_RUN:
        print(f"DRY RUN COMPLETE — {total} rows would be updated")
    else:
        print(f"COMPLETE — effective_to cleared on {total} rows across 2 tables")


if __name__ == "__main__":
    main()
