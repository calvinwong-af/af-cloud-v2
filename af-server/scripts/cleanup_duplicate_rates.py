"""
scripts/cleanup_duplicate_rates.py

Identify and delete redundant rate rows from air_freight_rates and haulage_rates.

A row is redundant if all its value fields are identical to its immediate predecessor
in the same (rate_card_id, supplier_id) group (ordered by effective_from ASC).
The oldest row in each value run is always kept.  The newest row overall in each
group is never deleted regardless.

DRY_RUN = True by default — prints what would be deleted without executing.
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
DRY_RUN = False   # Set to False to execute deletions
# ---------------------------------------------------------------------------

# ---- Value fields per table ------------------------------------------------

AIR_VALUE_FIELDS = [
    "currency", "rate_status",
    "l45_list_price", "p45_list_price", "p100_list_price", "p250_list_price",
    "p300_list_price", "p500_list_price", "p1000_list_price", "min_list_price",
    "l45_cost", "p45_cost", "p100_cost", "p250_cost",
    "p300_cost", "p500_cost", "p1000_cost", "min_cost",
    "surcharges::text",
]

HAULAGE_VALUE_FIELDS = [
    "currency", "rate_status",
    "list_price", "cost", "min_list_price", "min_cost",
    "surcharges::text", "side_loader_surcharge",
]


def _build_query(table: str, value_fields: list[str]) -> str:
    """Build the CTE query that identifies redundant rows."""
    lag_cols = []
    same_names = []
    for f in value_fields:
        alias = f.replace("::text", "").replace("::", "_")
        safe = alias + "_same"
        same_names.append(safe)
        lag_cols.append(
            f"LAG({f}) OVER w IS NOT DISTINCT FROM {f} AS {safe}"
        )

    lag_block = ",\n            ".join(lag_cols)
    same_check = " AND ".join(same_names)

    return f"""
WITH ranked AS (
    SELECT
        id,
        rate_card_id,
        supplier_id,
        effective_from,
        {lag_block},
        ROW_NUMBER() OVER w AS rn,
        COUNT(*) OVER (PARTITION BY rate_card_id, supplier_id) AS group_size
    FROM {table}
    WINDOW w AS (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from ASC)
),
ranked2 AS (
    SELECT *,
        MAX(rn) OVER (PARTITION BY rate_card_id, supplier_id) AS max_rn
    FROM ranked
),
redundant AS (
    SELECT id
    FROM ranked2
    WHERE rn > 1
      AND rn < max_rn
      AND group_size > 1
      AND {same_check}
)
SELECT id FROM redundant
"""


def _process_table(cur, table: str, value_fields: list[str]) -> int:
    """Find and optionally delete redundant rows for one table. Returns count."""
    print(f"\n[{table}] Scanning for redundant rows...")

    cur.execute(f"SELECT COUNT(*) FROM {table}")
    total = cur.fetchone()[0]

    cur.execute(f"SELECT COUNT(DISTINCT (rate_card_id, supplier_id)) FROM {table}")
    groups = cur.fetchone()[0]

    query = _build_query(table, value_fields)
    cur.execute(query)
    redundant_ids = [row[0] for row in cur.fetchall()]
    count = len(redundant_ids)

    print(f"  Total rows:     {total}")
    print(f"  Groups:         {groups}  (rate_card_id + supplier_id combinations)")
    print(f"  Redundant rows: {count}")

    if count > 0:
        sample = redundant_ids[:10]
        print(f"  Sample IDs to delete: {sample}")

    if DRY_RUN:
        print(f"  --> DRY RUN: would delete {count} rows")
    else:
        if count > 0:
            cur.execute(
                f"DELETE FROM {table} WHERE id = ANY(%s)",
                (redundant_ids,)
            )
            print(f"  --> Deleted {count} rows")
        else:
            print(f"  --> Nothing to delete")

    return count


def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    total_deleted = 0

    try:
        total_deleted += _process_table(cur, "air_freight_rates", AIR_VALUE_FIELDS)
    except Exception as e:
        print(f"\n[air_freight_rates] ERROR: {e}")

    try:
        total_deleted += _process_table(cur, "haulage_rates", HAULAGE_VALUE_FIELDS)
    except Exception as e:
        print(f"\n[haulage_rates] ERROR: {e}")

    cur.close()
    conn.close()

    print()
    if DRY_RUN:
        print(f"DRY RUN COMPLETE — {total_deleted} rows would be deleted")
    else:
        print(f"CLEANUP COMPLETE — {total_deleted} rows deleted across 2 tables")


if __name__ == "__main__":
    main()
