"""
scripts/dedup_transport_rates.py

Deduplicate redundant historical rate rows from port_transport_rates.

A "redundant" row is one where ALL price/value fields are identical to the
immediately preceding row for the same (rate_card_id, supplier_id) group
when ordered by effective_from ASC. The most recent row in each group is
always retained.

Before carry-forward logic existed, rates were entered month-by-month with
identical values. This script collapses those runs, keeping only the first
row (earliest effective_from) of each consecutive identical sequence.

Surcharges are compared as JSONB — two rows with identical surcharge arrays
(same codes, amounts, order) are considered duplicates. If surcharge order
differs between otherwise-identical rows, they will NOT be flagged as dupes.

Usage:
    cd af-server
    .venv/Scripts/python scripts/dedup_transport_rates.py             # dry-run (default)
    .venv/Scripts/python scripts/dedup_transport_rates.py --dry-run   # explicit dry-run
    .venv/Scripts/python scripts/dedup_transport_rates.py --execute   # actually delete
"""

import sys
import os
import argparse

sys.path.insert(0, ".")

from dotenv import load_dotenv
load_dotenv(".env.local")

import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in environment")
    sys.exit(1)

if DATABASE_URL.startswith("postgresql+psycopg2://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://", 1)


_DEDUP_CTE = """
WITH ranked AS (
    SELECT
        id,
        rate_card_id,
        supplier_id,
        effective_from,
        ROW_NUMBER() OVER (
            PARTITION BY rate_card_id, supplier_id
            ORDER BY effective_from DESC
        ) AS rn,
        currency,       LAG(currency)       OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_currency,
        uom,            LAG(uom)            OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_uom,
        list_price,     LAG(list_price)     OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_list_price,
        min_list_price, LAG(min_list_price) OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_min_list_price,
        cost,           LAG(cost)           OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_cost,
        min_cost,       LAG(min_cost)       OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_min_cost,
        roundup_qty,    LAG(roundup_qty)    OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_roundup_qty,
        surcharges,     LAG(surcharges)     OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_surcharges
    FROM port_transport_rates
    WHERE rate_status = 'PUBLISHED'
),
duplicates AS (
    SELECT id FROM ranked
    WHERE
        rn > 1
        AND prev_currency       IS NOT DISTINCT FROM currency
        AND prev_uom            IS NOT DISTINCT FROM uom
        AND prev_list_price     IS NOT DISTINCT FROM list_price
        AND prev_min_list_price IS NOT DISTINCT FROM min_list_price
        AND prev_cost           IS NOT DISTINCT FROM cost
        AND prev_min_cost       IS NOT DISTINCT FROM min_cost
        AND prev_roundup_qty    IS NOT DISTINCT FROM roundup_qty
        AND prev_surcharges     IS NOT DISTINCT FROM surcharges
)
"""

_COUNT_QUERY = _DEDUP_CTE + """
SELECT
    (SELECT COUNT(*) FROM port_transport_rates WHERE rate_status = 'PUBLISHED') AS total,
    (SELECT COUNT(*) FROM duplicates) AS dup_count
"""

_DELETE_QUERY = _DEDUP_CTE + """
DELETE FROM port_transport_rates WHERE id IN (SELECT id FROM duplicates)
"""


def main():
    parser = argparse.ArgumentParser(description="Deduplicate redundant port_transport_rates rows")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--dry-run", action="store_true", default=True, help="Show what would be deleted (default)")
    group.add_argument("--execute", action="store_true", help="Actually delete duplicate rows")
    args = parser.parse_args()

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    print("=== Port Transport Rate Deduplication ===")
    if args.execute:
        print("Mode: EXECUTE (will delete rows)")
    else:
        print("Mode: DRY RUN (pass --execute to delete)")
    print()

    try:
        cur = conn.cursor()

        cur.execute(_COUNT_QUERY)
        row = cur.fetchone()
        total, dup_count = row[0], row[1]
        retained = total - dup_count

        print(f"port_transport_rates:  {total:,} total PUBLISHED rows")
        print(f"  Duplicates identified: {dup_count:,}")
        print(f"  Rows retained:         {retained:,}")

        if not args.execute:
            print("\nDRY RUN complete. No rows deleted.")
            conn.rollback()
            return

        if dup_count == 0:
            print("\nNo duplicates found. Nothing to do.")
            conn.rollback()
            return

        print()
        confirm = input(f"Type YES to delete {dup_count:,} rows: ")
        if confirm.strip() != "YES":
            print("Aborted.")
            conn.rollback()
            return

        cur.execute(_DELETE_QUERY)
        deleted = cur.rowcount
        conn.commit()
        print(f"\nDeleted {deleted:,} rows from port_transport_rates.")
        print("Done. Changes committed.")

    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        print("Transaction rolled back. No rows deleted.")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
