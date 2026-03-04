"""
scripts/backfill_v1_ports.py

Backfills origin_port, origin_terminal, dest_port, dest_terminal in PostgreSQL
for V1 migrated shipments by reading the current nested origin/destination objects
from Datastore ShipmentOrder records.

The original migrate_to_postgres.py read flat fields that don't exist on V1 records,
so all V1 shipments have NULL port columns. This script fixes that.

Usage:
  python -m scripts.backfill_v1_ports --dry-run   # preview
  python -m scripts.backfill_v1_ports              # execute
  python -m scripts.backfill_v1_ports --force      # update even if ports already set
"""

import sys

sys.path.insert(0, ".")

from dotenv import load_dotenv

load_dotenv(".env.local")

from core.datastore import get_client
from core.db import get_engine
from sqlalchemy import text


def afcq_to_af(afcq_id: str) -> str:
    """Convert AFCQ-003794 → AF-003794"""
    return afcq_id.replace("AFCQ-", "AF-", 1)


def main():
    dry_run = "--dry-run" in sys.argv
    force = "--force" in sys.argv

    if dry_run:
        print("=== DRY RUN MODE — no writes will be made ===\n")
    else:
        print("=== LIVE MODE — writing to PostgreSQL ===\n")

    ds_client = get_client()
    engine = get_engine()

    # --- Phase 1: Read all V1 ShipmentOrder records from Datastore ---
    print("Scanning Datastore ShipmentOrder...", flush=True)

    records = []  # (af_id, origin_port, origin_terminal, dest_port, dest_terminal)
    total_v1 = 0
    with_origin = 0
    with_dest = 0
    skipped_no_prefix = 0

    so_query = ds_client.query(kind="ShipmentOrder")
    for entity in so_query.fetch():
        key_name = entity.key.name or entity.key.id
        if not key_name or not str(key_name).startswith("AFCQ-"):
            skipped_no_prefix += 1
            continue

        total_v1 += 1
        af_id = afcq_to_af(str(key_name))

        origin_port = None
        origin_terminal = None
        dest_port = None
        dest_terminal = None

        origin = entity.get("origin")
        if isinstance(origin, dict):
            code = origin.get("port_un_code")
            if code and isinstance(code, str) and code.strip():
                origin_port = code.strip().upper()
                with_origin += 1
            tid = origin.get("terminal_id")
            if tid and isinstance(tid, str) and tid.strip():
                origin_terminal = tid.strip().upper()

        destination = entity.get("destination")
        if isinstance(destination, dict):
            code = destination.get("port_un_code")
            if code and isinstance(code, str) and code.strip():
                dest_port = code.strip().upper()
                with_dest += 1
            tid = destination.get("terminal_id")
            if tid and isinstance(tid, str) and tid.strip():
                dest_terminal = tid.strip().upper()

        # Only include if we have at least one port to write
        if origin_port or dest_port:
            records.append((af_id, origin_port, origin_terminal, dest_port, dest_terminal))

    print(f"  Total V1 records found:   {total_v1}")
    print(f"  Records with origin port: {with_origin}")
    print(f"  Records with dest port:   {with_dest}")
    print(f"  Skipped (no AFCQ- prefix):{skipped_no_prefix}")
    print(f"  Records to process:       {len(records)}")
    print()

    # --- Phase 2: Update PostgreSQL ---
    print("PostgreSQL updates:", flush=True)

    updated = 0
    skipped = 0
    not_found = 0
    errors = 0
    samples = []

    # Build the WHERE condition based on --force flag
    if force:
        where_clause = "WHERE id = :id AND migrated_from_v1 = TRUE"
    else:
        where_clause = (
            "WHERE id = :id AND migrated_from_v1 = TRUE "
            "AND (origin_port IS NULL OR dest_port IS NULL)"
        )

    update_sql = text(f"""
        UPDATE shipments SET
            origin_port = :origin_port,
            origin_terminal = :origin_terminal,
            dest_port = :dest_port,
            dest_terminal = :dest_terminal,
            updated_at = NOW()
        {where_clause}
    """)

    with engine.connect() as conn:
        for af_id, origin_port, origin_terminal, dest_port, dest_terminal in records:
            try:
                if dry_run:
                    # Check if the row exists and would be updated
                    check = conn.execute(
                        text(f"SELECT id, origin_port, dest_port FROM shipments {where_clause}"),
                        {"id": af_id},
                    ).fetchone()
                    if check:
                        updated += 1
                        if len(samples) < 5:
                            o_str = origin_port or "-"
                            ot_str = f" (terminal={origin_terminal})" if origin_terminal else ""
                            d_str = dest_port or "-"
                            dt_str = f" (terminal={dest_terminal})" if dest_terminal else ""
                            samples.append(f"  {af_id}: origin={o_str}{ot_str}, dest={d_str}{dt_str}")
                    else:
                        # Check if row exists at all
                        exists = conn.execute(
                            text("SELECT 1 FROM shipments WHERE id = :id"),
                            {"id": af_id},
                        ).fetchone()
                        if exists:
                            skipped += 1
                        else:
                            not_found += 1
                else:
                    result = conn.execute(
                        update_sql,
                        {
                            "id": af_id,
                            "origin_port": origin_port,
                            "origin_terminal": origin_terminal,
                            "dest_port": dest_port,
                            "dest_terminal": dest_terminal,
                        },
                    )
                    if result.rowcount > 0:
                        updated += 1
                        if len(samples) < 5:
                            o_str = origin_port or "-"
                            ot_str = f" (terminal={origin_terminal})" if origin_terminal else ""
                            d_str = dest_port or "-"
                            dt_str = f" (terminal={dest_terminal})" if dest_terminal else ""
                            samples.append(f"  {af_id}: origin={o_str}{ot_str}, dest={d_str}{dt_str}")
                    else:
                        skipped += 1
            except Exception as e:
                print(f"  ERROR on {af_id}: {e}")
                errors += 1

        if not dry_run and updated > 0:
            conn.commit()

    print(f"  Updated:   {updated}")
    print(f"  Skipped:   {skipped}  (already had port data or no match)")
    if not_found > 0:
        print(f"  Not found: {not_found}  (no PostgreSQL row)")
    print(f"  Errors:    {errors}")

    if samples:
        print()
        print(f"Sample updates (first {len(samples)}):")
        for s in samples:
            print(s)

    print()
    prefix = "DRY RUN " if dry_run else ""
    print(f"{prefix}Backfill complete.")


if __name__ == "__main__":
    main()
