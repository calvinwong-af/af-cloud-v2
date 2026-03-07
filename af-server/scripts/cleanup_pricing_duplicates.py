"""
scripts/cleanup_pricing_duplicates.py

Deduplicate consecutive identical rate rows in fcl_rates and lcl_rates.

Keeps the earliest row in any sequence of identical consecutive records
(same rate_card_id + supplier_id, sorted by effective_from ASC) where
all rate value fields are identical.

Usage:
    cd af-server
    .venv/Scripts/python scripts/cleanup_pricing_duplicates.py --dry-run
    .venv/Scripts/python scripts/cleanup_pricing_duplicates.py
"""

import argparse
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

from sqlalchemy import text
from core.db import get_engine

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Fields that must all match for two consecutive rows to be considered duplicates
_RATE_FIELDS = [
    "list_price", "min_list_price", "cost", "min_cost",
    "lss", "baf", "ecrs", "psc",
    "uom", "currency", "roundup_qty", "rate_status",
]


def _find_duplicates(conn, table: str) -> list[int]:
    """Find duplicate rate IDs in the given table."""
    rows = conn.execute(text(f"""
        SELECT id, rate_card_id, supplier_id, effective_from,
               list_price, min_list_price, cost, min_cost,
               lss, baf, ecrs, psc, uom, currency, roundup_qty,
               rate_status::text
        FROM {table}
        ORDER BY rate_card_id, supplier_id NULLS FIRST, effective_from ASC
    """)).fetchall()

    ids_to_delete: list[int] = []
    prev_group_key = None
    prev_values = None

    for row in rows:
        rid = row[0]
        group_key = (row[1], row[2])  # rate_card_id, supplier_id
        values = tuple(row[4:])       # all rate value fields

        if group_key == prev_group_key and values == prev_values:
            ids_to_delete.append(rid)
        else:
            prev_values = values

        prev_group_key = group_key

    return ids_to_delete


def main():
    parser = argparse.ArgumentParser(description="Deduplicate consecutive identical pricing rows")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be deleted, no actual deletes")
    args = parser.parse_args()

    engine = get_engine()

    with engine.connect() as conn:
        logger.info("=== Step 1: Identify duplicate FCL rates ===")
        fcl_dups = _find_duplicates(conn, "fcl_rates")
        logger.info(f"  FCL duplicates found: {len(fcl_dups)}")

        logger.info("\n=== Step 2: Identify duplicate LCL rates ===")
        lcl_dups = _find_duplicates(conn, "lcl_rates")
        logger.info(f"  LCL duplicates found: {len(lcl_dups)}")

        if not args.dry_run:
            if fcl_dups:
                logger.info("\n=== Step 3: Delete FCL duplicates ===")
                for i in range(0, len(fcl_dups), 500):
                    chunk = fcl_dups[i:i + 500]
                    conn.execute(text(
                        f"DELETE FROM fcl_rates WHERE id = ANY(:ids)"
                    ), {"ids": chunk})
                logger.info(f"  Deleted {len(fcl_dups)} FCL duplicate rows")

            if lcl_dups:
                logger.info("\n=== Step 4: Delete LCL duplicates ===")
                for i in range(0, len(lcl_dups), 500):
                    chunk = lcl_dups[i:i + 500]
                    conn.execute(text(
                        f"DELETE FROM lcl_rates WHERE id = ANY(:ids)"
                    ), {"ids": chunk})
                logger.info(f"  Deleted {len(lcl_dups)} LCL duplicate rows")

            conn.commit()

        prefix = "DRY RUN — " if args.dry_run else ""
        logger.info(f"\n{prefix}Summary:")
        logger.info(f"  FCL duplicates: {len(fcl_dups)}")
        logger.info(f"  LCL duplicates: {len(lcl_dups)}")
        logger.info(f"  Total: {len(fcl_dups) + len(lcl_dups)}")


if __name__ == "__main__":
    main()
