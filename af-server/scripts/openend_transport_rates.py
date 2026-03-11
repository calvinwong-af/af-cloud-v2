"""
scripts/openend_transport_rates.py

Sets effective_to = NULL on the latest active rate row per (rate_card_id,
supplier_id) group in port_transport_rates.

After migration, each month's rate was inserted with a closed effective_to
(last day of that month), and the most recent month was left open-ended.
After dedup (dedup_transport_rates.py), the LATEST identical row in each
consecutive run is removed — leaving the EARLIEST row of each run as the
survivor. That survivor retains its original closed effective_to, so rates
no longer carry forward past their first month.

This script restores open-ended carry-forward by NULLing effective_to on
the latest surviving row per (rate_card_id, supplier_id) group.

Only touches PUBLISHED rows that currently have a non-NULL effective_to.

DRY_RUN = True by default. Set to False or use --execute to apply.

Usage (from af-server root with venv active and Auth Proxy running):
    .venv\\Scripts\\python scripts\\openend_transport_rates.py             # dry-run
    .venv\\Scripts\\python scripts\\openend_transport_rates.py --execute   # apply
"""

import os
import sys
import argparse
from datetime import datetime, timezone

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


# Find the latest PUBLISHED row per (rate_card_id, supplier_id) group
# that has a non-NULL effective_to — these should be open-ended.
_FIND_QUERY = """
SELECT DISTINCT ON (rate_card_id, supplier_id)
    id, rate_card_id, supplier_id, effective_from, effective_to
FROM port_transport_rates
WHERE rate_status = 'PUBLISHED'
  AND effective_to IS NOT NULL
ORDER BY rate_card_id, supplier_id, effective_from DESC
"""

_UPDATE_QUERY = """
UPDATE port_transport_rates
SET effective_to = NULL,
    updated_at = :now
WHERE id = ANY(:ids)
"""


def main():
    parser = argparse.ArgumentParser(
        description="Open-end the latest port_transport_rates row per group after dedup"
    )
    parser.add_argument("--execute", action="store_true",
                        help="Apply changes (default is dry-run)")
    args = parser.parse_args()

    dry_run = not args.execute

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    print("=== Open-End Transport Rates ===")
    print(f"Mode: {'DRY RUN' if dry_run else 'EXECUTE'}\n")

    try:
        cur = conn.cursor()

        cur.execute(_FIND_QUERY)
        rows = cur.fetchall()
        ids_to_update = [r[0] for r in rows]
        count = len(ids_to_update)

        print(f"  Groups found with closed latest row: {count:,}")

        if count > 0 and dry_run:
            print(f"\n  Sample (first 10):")
            for r in rows[:10]:
                print(f"    id={r[0]}  card_id={r[1]}  supplier={r[2]}  "
                      f"eff_from={r[3]}  eff_to={r[4]}")

        if dry_run:
            print(f"\nDRY RUN complete — {count:,} rows would be set to effective_to = NULL.")
            print("Run with --execute to apply.")
            conn.rollback()
            return

        if count == 0:
            print("\nNo rows to update. Nothing to do.")
            conn.rollback()
            return

        now = datetime.now(timezone.utc).isoformat()
        cur.execute(
            "UPDATE port_transport_rates SET effective_to = NULL, updated_at = %s "
            "WHERE id = ANY(%s)",
            (now, ids_to_update)
        )
        updated = cur.rowcount
        conn.commit()

        print(f"\nUpdated {updated:,} rows → effective_to = NULL.")
        print("Done. Changes committed.")

    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        print("Transaction rolled back. No changes applied.")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
