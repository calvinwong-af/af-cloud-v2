"""
scripts/backfill_numeric_status.py

One-time backfill: converts any orders.status values that were written as
numeric strings (e.g. '1001', '2001') into the correct string status + sub_status
used by the unified orders architecture.

Safe to re-run — only touches rows where status is a numeric string.

Usage:
    cd af-server
    .venv/Scripts/python scripts/backfill_numeric_status.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

from sqlalchemy import text
from core.db import get_engine


MIGRATIONS = [
    # (numeric_value, new_status, new_sub_status)
    (1001, "draft",       None),
    (1002, "draft",       None),
    (2001, "confirmed",   "confirmed"),
    (3001, "in_progress", "booking_pending"),
    (3002, "in_progress", "booking_confirmed"),
    (4001, "in_progress", "in_transit"),
    (4002, "in_progress", "arrived"),
    (5001, "completed",   None),
    (-1,   "cancelled",   None),
]


def run():
    engine = get_engine()
    with engine.connect() as conn:
        # Preview: count affected rows
        total = conn.execute(text("""
            SELECT COUNT(*) FROM orders
            WHERE status ~ '^-?[0-9]+$'
        """)).scalar() or 0

        print(f"Found {total} orders with numeric string status values.")
        if total == 0:
            print("Nothing to do.")
            return

        # Show breakdown
        rows = conn.execute(text("""
            SELECT status, COUNT(*) FROM orders
            WHERE status ~ '^-?[0-9]+$'
            GROUP BY status ORDER BY status
        """)).fetchall()
        print("\nBreakdown:")
        for r in rows:
            print(f"  status='{r[0]}': {r[1]} rows")

        print()
        confirm = input("Proceed with backfill? (yes/no): ").strip().lower()
        if confirm != "yes":
            print("Aborted.")
            return

        # Run migrations
        total_updated = 0
        for (num_val, str_status, str_sub_status) in MIGRATIONS:
            result = conn.execute(text("""
                UPDATE orders
                SET status = :str_status,
                    sub_status = :str_sub_status
                WHERE status ~ '^-?[0-9]+$'
                  AND status::integer = :num_val
            """), {
                "str_status": str_status,
                "str_sub_status": str_sub_status,
                "num_val": num_val,
            })
            count = result.rowcount
            if count > 0:
                print(f"  {num_val} -> ('{str_status}', '{str_sub_status}'): {count} rows updated")
                total_updated += count

        conn.commit()
        print(f"\nDone. {total_updated} rows updated.")


if __name__ == "__main__":
    run()
