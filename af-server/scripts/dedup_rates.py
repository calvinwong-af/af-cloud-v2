"""
scripts/dedup_rates.py

Deduplicate redundant historical rate rows from fcl_rates and lcl_rates.

A "redundant" row is one where ALL price/surcharge fields are identical to
the immediately preceding row for the same (rate_card_id, supplier_id) group
when ordered by effective_from. The most recent row in each group is always
retained.

Usage:
    cd af-server
    .venv/Scripts/python scripts/dedup_rates.py             # dry-run (default)
    .venv/Scripts/python scripts/dedup_rates.py --dry-run   # explicit dry-run
    .venv/Scripts/python scripts/dedup_rates.py --execute    # actually delete
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

# psycopg2 requires a plain DSN — strip SQLAlchemy driver prefix if present
if DATABASE_URL.startswith("postgresql+psycopg2://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://", 1)


_DEDUP_QUERY = """
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
        currency,      LAG(currency)      OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_currency,
        uom,           LAG(uom)           OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_uom,
        list_price,    LAG(list_price)    OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_list_price,
        min_list_price,LAG(min_list_price)OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_min_list_price,
        cost,          LAG(cost)          OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_cost,
        min_cost,      LAG(min_cost)      OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_min_cost,
        roundup_qty,   LAG(roundup_qty)   OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_roundup_qty,
        lss,           LAG(lss)           OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_lss,
        baf,           LAG(baf)           OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_baf,
        ecrs,          LAG(ecrs)          OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_ecrs,
        psc,           LAG(psc)           OVER (PARTITION BY rate_card_id, supplier_id ORDER BY effective_from) AS prev_psc
    FROM {table}
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
        AND prev_lss            IS NOT DISTINCT FROM lss
        AND prev_baf            IS NOT DISTINCT FROM baf
        AND prev_ecrs           IS NOT DISTINCT FROM ecrs
        AND prev_psc            IS NOT DISTINCT FROM psc
)
"""

_COUNT_QUERY_TEMPLATE = """
SELECT
    (SELECT COUNT(*) FROM {table} WHERE rate_status = 'PUBLISHED') AS total,
    (SELECT COUNT(*) FROM duplicates) AS dup_count
"""

_DELETE_QUERY_TEMPLATE = "DELETE FROM {table} WHERE id IN (SELECT id FROM duplicates)"


def get_counts(cur, table: str) -> tuple[int, int]:
    query = _DEDUP_QUERY.format(table=table) + _COUNT_QUERY_TEMPLATE.format(table=table)
    cur.execute(query)
    row = cur.fetchone()
    return row[0], row[1]


def delete_duplicates(cur, table: str) -> int:
    query = _DEDUP_QUERY.format(table=table) + _DELETE_QUERY_TEMPLATE.format(table=table)
    cur.execute(query)
    return cur.rowcount


def main():
    parser = argparse.ArgumentParser(description="Deduplicate redundant rate rows")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--dry-run", action="store_true", default=True, help="Show what would be deleted (default)")
    group.add_argument("--execute", action="store_true", help="Actually delete duplicate rows")
    args = parser.parse_args()

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    print("=== Rate Deduplication ===")
    if args.execute:
        print("Mode: EXECUTE (will delete rows)")
    else:
        print("Mode: DRY RUN (pass --execute to delete)")
    print()

    try:
        cur = conn.cursor()

        tables = ["fcl_rates", "lcl_rates"]
        results = {}
        total_dups = 0

        for table in tables:
            total, dup_count = get_counts(cur, table)
            retained = total - dup_count
            results[table] = (total, dup_count, retained)
            total_dups += dup_count
            print(f"{table}:  {total:,} total PUBLISHED rows -> {dup_count:,} duplicates identified ({retained:,} unique retained)")

        print(f"\nTotal rows to delete: {total_dups:,}")
        print()

        if not args.execute:
            print("DRY RUN complete. No rows deleted.")
            conn.rollback()
            return

        if total_dups == 0:
            print("No duplicates found. Nothing to do.")
            conn.rollback()
            return

        confirm = input("Type YES to proceed: ")
        if confirm.strip() != "YES":
            print("Aborted.")
            conn.rollback()
            return

        for table in tables:
            deleted = delete_duplicates(cur, table)
            print(f"Deleted {deleted:,} rows from {table}")

        conn.commit()
        print("\nDone. Changes committed.")

    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        print("Transaction rolled back. No rows deleted.")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
