"""
scripts/backfill_scope_from_tasks.py

Backfill the new scope schema on shipment_details from existing workflow_tasks.

For each shipment:
1. Read workflow_tasks from shipment_workflows
2. For each scope key (first_mile, export_clearance, import_clearance, last_mile):
   - Find the corresponding task (ORIGIN_HAULAGE, EXPORT_CLEARANCE, etc.)
   - If task exists: scope key = task's current mode (ASSIGNED/TRACKED/IGNORED)
   - If task not found: scope key = "IGNORED"
3. Write the derived scope dict to shipment_details.scope

Safe to re-run (idempotent). Use --dry-run to preview without writing.
"""

import argparse
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.db import get_engine
from sqlalchemy import text
from logic.incoterm_tasks import TASK_TYPE_TO_SCOPE_KEY, ASSIGNED, IGNORED

SCOPE_KEY_TO_TASK_TYPE = {v: k for k, v in TASK_TYPE_TO_SCOPE_KEY.items()}
SCOPE_KEYS = ["first_mile", "export_clearance", "import_clearance", "last_mile"]
VALID_MODES = {ASSIGNED, "TRACKED", IGNORED}


def _parse_jsonb(val):
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (ValueError, TypeError):
            return val
    return val


def _is_new_schema(scope: dict) -> bool:
    if not scope:
        return False
    return any(v in VALID_MODES for v in scope.values())


def main():
    parser = argparse.ArgumentParser(description="Backfill scope from workflow tasks")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    engine = get_engine()

    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT sd.order_id, sd.scope, sw.workflow_tasks
            FROM shipment_details sd
            JOIN shipment_workflows sw ON sw.order_id = sd.order_id
            JOIN orders o ON o.order_id = sd.order_id
            WHERE o.order_type = 'shipment' AND o.trash = FALSE
        """)).fetchall()

        total = len(rows)
        updated = 0
        skipped_no_tasks = 0
        skipped_already_set = 0
        errors = 0

        for row in rows:
            order_id = row[0]
            existing_scope = _parse_jsonb(row[1])
            tasks = _parse_jsonb(row[2]) or []

            # Skip if scope already uses new schema
            if existing_scope and _is_new_schema(existing_scope):
                skipped_already_set += 1
                continue

            if not tasks:
                skipped_no_tasks += 1
                continue

            # Build task type → mode map
            task_mode_map = {}
            for task in tasks:
                tt = task.get("task_type", "")
                mode = task.get("mode", ASSIGNED)
                task_mode_map[tt] = mode

            # Derive scope from existing tasks
            scope = {}
            for scope_key in SCOPE_KEYS:
                task_type = SCOPE_KEY_TO_TASK_TYPE[scope_key]
                mode = task_mode_map.get(task_type)
                if mode and mode in VALID_MODES:
                    scope[scope_key] = mode
                elif mode:
                    scope[scope_key] = ASSIGNED
                else:
                    scope[scope_key] = IGNORED

            if args.dry_run:
                print(f"  {order_id}: {scope}")
            else:
                try:
                    conn.execute(text("""
                        UPDATE shipment_details SET scope = CAST(:scope AS jsonb)
                        WHERE order_id = :id
                    """), {"scope": json.dumps(scope), "id": order_id})
                    updated += 1
                except Exception as e:
                    print(f"  ERROR {order_id}: {e}")
                    errors += 1

        if not args.dry_run:
            conn.commit()

        print(f"\n{'DRY RUN — ' if args.dry_run else ''}Summary:")
        print(f"  Total shipments:      {total}")
        print(f"  Updated:              {updated if not args.dry_run else total - skipped_no_tasks - skipped_already_set}")
        print(f"  Skipped (no tasks):   {skipped_no_tasks}")
        print(f"  Skipped (already set):{skipped_already_set}")
        if errors:
            print(f"  Errors:               {errors}")


if __name__ == "__main__":
    main()
