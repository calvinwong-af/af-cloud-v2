"""
scripts/backfill_v1_issued_invoice.py

One-time backfill: mark all migrated V1 completed shipments as issued_invoice=TRUE.

Rationale:
  V1 shipments completed before the invoiced-tracking feature was introduced have
  issued_invoice=FALSE in PostgreSQL simply because the field did not exist in the
  old system, not because they were genuinely un-invoiced. All V1 completed records
  predate the feature and should be treated as already invoiced.

Scope:
  UPDATE shipments
  SET issued_invoice = TRUE
  WHERE migrated_from_v1 = TRUE
    AND status = 5001          -- Completed
    AND issued_invoice = FALSE -- Not yet backfilled (idempotent)

Usage:
    cd af-server
    .venv/Scripts/python scripts/backfill_v1_issued_invoice.py --dry-run
    .venv/Scripts/python scripts/backfill_v1_issued_invoice.py --commit
"""

import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

from sqlalchemy import text
from core.db import get_engine


def main():
    parser = argparse.ArgumentParser(description="Backfill issued_invoice for V1 completed shipments")
    parser.add_argument("--dry-run", action="store_true", help="Count affected rows without updating")
    parser.add_argument("--commit", action="store_true", help="Apply the update")
    args = parser.parse_args()

    if not args.dry_run and not args.commit:
        print("Specify --dry-run or --commit")
        sys.exit(1)

    engine = get_engine()

    with engine.connect() as conn:
        count_row = conn.execute(text("""
            SELECT COUNT(*) FROM shipments
            WHERE migrated_from_v1 = TRUE
              AND status = 5001
              AND issued_invoice = FALSE
        """)).fetchone()
        affected = count_row[0] if count_row else 0

        print(f"Rows to update: {affected}")

        if args.dry_run:
            print("Dry run - no changes made.")
            return

        if affected == 0:
            print("Nothing to do - all V1 completed shipments already marked as invoiced.")
            return

        conn.execute(text("""
            UPDATE shipments
            SET issued_invoice = TRUE
            WHERE migrated_from_v1 = TRUE
              AND status = 5001
              AND issued_invoice = FALSE
        """))
        conn.commit()

        remaining = conn.execute(text("""
            SELECT COUNT(*) FROM shipments
            WHERE migrated_from_v1 = TRUE
              AND status = 5001
              AND issued_invoice = FALSE
        """)).fetchone()[0]

        print(f"Updated {affected} rows. Remaining un-invoiced V1 completed: {remaining}")
        if remaining == 0:
            print("Backfill complete.")
        else:
            print(f"WARNING: {remaining} rows still un-invoiced - investigate.")


if __name__ == "__main__":
    main()
