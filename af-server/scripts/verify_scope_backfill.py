"""
scripts/verify_scope_backfill.py

Read-only verification: checks whether the scope backfill has been run on the
connected database (local or prod via Cloud SQL Auth Proxy).

Reports:
  - How many shipments are on the new scope schema (ASSIGNED/TRACKED/IGNORED values)
  - How many are still on the old schema (boolean values or null)
  - How many have no workflow_tasks (V1 legacy — expected to be ~2006 on prod)

Usage:
    .venv\\Scripts\\python scripts\\verify_scope_backfill.py
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

from core.db import get_engine
from sqlalchemy import text

VALID_MODES = {"ASSIGNED", "TRACKED", "IGNORED"}


def _parse_jsonb(val):
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return None
    return None


def _is_new_schema(scope: dict) -> bool:
    if not scope:
        return False
    return any(v in VALID_MODES for v in scope.values())


def main():
    engine = get_engine()

    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT o.order_id, o.scope, sw.workflow_tasks
            FROM orders o
            JOIN shipment_details sd ON sd.order_id = o.order_id
            JOIN shipment_workflows sw ON sw.order_id = o.order_id
            WHERE o.order_type = 'shipment' AND o.trash = FALSE
        """)).fetchall()

    total = len(rows)
    new_schema = 0
    old_schema = 0
    null_scope = 0
    no_tasks = 0

    for row in rows:
        scope = _parse_jsonb(row[1])
        tasks = _parse_jsonb(row[2]) or []
        has_tasks = bool(tasks)

        if not has_tasks:
            no_tasks += 1
            # V1 legacy — no tasks, scope will never be derived. Not a migration concern.
            continue

        if scope is None:
            null_scope += 1
        elif _is_new_schema(scope):
            new_schema += 1
        else:
            old_schema += 1

    # Eligible = shipments that have tasks (V2 records)
    eligible = total - no_tasks
    needs_migration = old_schema + null_scope

    print(f"\nScope Backfill Verification")
    print(f"{'─' * 40}")
    print(f"  Total shipments:              {total}")
    print(f"  ℹ️  V1 legacy (no tasks):      {no_tasks}  — not applicable, skipped")
    print(f"  ─")
    print(f"  Eligible (V2, has tasks):     {eligible}")
    print(f"  ✅ New schema (migrated):      {new_schema}")
    print(f"  ⚠️  Old schema (needs backfill):{old_schema}")
    print(f"  ⚠️  Null scope (needs backfill):{null_scope}")
    print(f"{'─' * 40}")

    if needs_migration == 0:
        print(f"  ✅ Backfill complete — all {eligible} eligible shipments on new schema.")
    elif new_schema == 0:
        print(f"  ❌ Backfill has NOT been run on eligible shipments.")
    else:
        print(f"  ⚠️  Backfill incomplete — {needs_migration} eligible shipments still need migration.")

    print()


if __name__ == "__main__":
    main()
