"""
scripts/consolidate_rates.py

Consolidate migrated monthly rate rows in local_charges and customs_rates.

Migrated data has one row per calendar month. This script collapses consecutive
months with identical price + cost into single rows with extended effective_to.

** Take a database backup before running with DRY_RUN = False. **

Usage (from project root C:\\dev\\af-cloud-v2):
    af-server\\.venv\\Scripts\\python.exe af-server/scripts/consolidate_rates.py
"""

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import create_engine, text

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DRY_RUN = False  # flip to True to preview without changes

# PostgreSQL — Cloud SQL Auth Proxy must be running on localhost:5432
PG_DSN = "postgresql+psycopg2://af_server:Afserver_2019@localhost:5432/accelefreight"


# ---------------------------------------------------------------------------
# Table definitions
# ---------------------------------------------------------------------------

TABLES = [
    {
        "name": "local_charges",
        "card_key_cols": [
            "port_code", "trade_direction", "shipment_type",
            "container_size", "container_type", "charge_code", "is_domestic",
        ],
        "card_label_fn": lambda row: (
            f"[{row['port_code']} | {row['trade_direction']} | {row['shipment_type']} | "
            f"{row['container_size']} | {row['container_type']} | {row['charge_code']} | "
            f"dom={row['is_domestic']}]"
        ),
    },
    {
        "name": "customs_rates",
        "card_key_cols": [
            "port_code", "trade_direction", "shipment_type",
            "charge_code", "is_domestic",
        ],
        "card_label_fn": lambda row: (
            f"[{row['port_code']} | {row['trade_direction']} | {row['shipment_type']} | "
            f"{row['charge_code']} | dom={row['is_domestic']}]"
        ),
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_date(val):
    """Parse a date value from a DB row — could be date, str, or None."""
    if val is None:
        return None
    if isinstance(val, date):
        return val
    return date.fromisoformat(str(val))


def find_runs(rows):
    """
    Walk rows (ordered by effective_from ASC) and identify consolidation runs.

    A run is broken when:
      - price or cost changes
      - is_active changes
      - there is a gap (effective_from != prev effective_to + 1 day)
      - prev effective_to is NULL (open-ended — can't extend past it)

    Returns a list of runs, where each run is a list of row dicts.
    """
    if not rows:
        return []

    runs = []
    current_run = [rows[0]]

    for i in range(1, len(rows)):
        prev = rows[i - 1]
        curr = rows[i]

        prev_eff_to = parse_date(prev["effective_to"])
        curr_eff_from = parse_date(curr["effective_from"])

        # Break conditions
        same_price = prev["price"] == curr["price"]
        same_cost = prev["cost"] == curr["cost"]
        same_active = prev["is_active"] == curr["is_active"]

        # Gap check: prev_eff_to must exist and curr_eff_from == prev_eff_to + 1
        no_gap = (
            prev_eff_to is not None
            and curr_eff_from is not None
            and curr_eff_from == prev_eff_to + timedelta(days=1)
        )

        if same_price and same_cost and same_active and no_gap:
            current_run.append(curr)
        else:
            runs.append(current_run)
            current_run = [curr]

    runs.append(current_run)
    return runs


# ---------------------------------------------------------------------------
# Process a single table
# ---------------------------------------------------------------------------

def process_table(engine, table_config):
    table_name = table_config["name"]
    card_key_cols = table_config["card_key_cols"]
    card_label_fn = table_config["card_label_fn"]

    print(f"\n{'=' * 60}")
    print(f"=== {table_name} ===")
    print(f"{'=' * 60}")

    with engine.connect() as conn:
        # Count rows before
        total_rows = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()
        print(f"  Total rows: {total_rows}")

        # Fetch all rows ordered for grouping
        order_cols = ", ".join(card_key_cols + ["effective_from ASC"])
        rows = conn.execute(text(
            f"SELECT id, {', '.join(card_key_cols)}, price, cost, is_active, "
            f"effective_from, effective_to "
            f"FROM {table_name} "
            f"ORDER BY {order_cols}"
        )).fetchall()

        # Map to dicts
        col_names = ["id"] + card_key_cols + ["price", "cost", "is_active", "effective_from", "effective_to"]
        row_dicts = [dict(zip(col_names, r)) for r in rows]

        # Group by card key
        groups = defaultdict(list)
        for rd in row_dicts:
            key = tuple(rd[c] for c in card_key_cols)
            groups[key].append(rd)

        print(f"  Card groups: {len(groups)}")

        # Process each group
        total_runs_to_consolidate = 0
        total_rows_to_delete = 0
        sample_consolidations = []

        ids_to_delete = []
        updates = []  # list of (keep_id, new_effective_to)

        for card_key, card_rows in groups.items():
            runs = find_runs(card_rows)

            for run in runs:
                if len(run) < 2:
                    continue

                total_runs_to_consolidate += 1
                keep = run[0]  # earliest effective_from
                last = run[-1]

                # Determine new effective_to
                last_eff_to = parse_date(last["effective_to"])
                new_eff_to = None if last_eff_to is None else last_eff_to

                rows_deleted_in_run = len(run) - 1
                total_rows_to_delete += rows_deleted_in_run

                # Collect IDs to delete (all but the kept row)
                for r in run[1:]:
                    ids_to_delete.append(r["id"])

                # Collect update for the kept row
                updates.append((keep["id"], new_eff_to))

                # Sample consolidation for display
                if len(sample_consolidations) < 20:
                    eff_from_str = str(parse_date(keep["effective_from"]))
                    eff_to_str = str(new_eff_to) if new_eff_to else "null"
                    label = card_label_fn(keep)
                    sample_consolidations.append(
                        f"  {label}\n"
                        f"    Run: {len(run)} rows -> 1 row  "
                        f"({eff_from_str} -> {eff_to_str})  "
                        f"price={float(keep['price']):.2f} cost={float(keep['cost']):.2f}"
                    )

        rows_remaining = total_rows - total_rows_to_delete
        ratio = (total_rows_to_delete / total_rows * 100) if total_rows > 0 else 0

        print(f"  Runs to consolidate: {total_runs_to_consolidate}  (runs with 2+ rows)")
        print(f"  Rows that would be deleted: {total_rows_to_delete}")
        print(f"  Rows remaining after consolidation: {rows_remaining}")
        print(f"  Consolidation ratio: {ratio:.1f}%")

        if sample_consolidations:
            print(f"\nSample consolidations (first {len(sample_consolidations)}):")
            for s in sample_consolidations:
                print(s)

        # Execute if not dry run
        if not DRY_RUN and (ids_to_delete or updates):
            print(f"\n[LIVE] Executing consolidation for {table_name}...")

            # Update kept rows
            updated_count = 0
            for keep_id, new_eff_to in updates:
                conn.execute(text(
                    f"UPDATE {table_name} SET effective_to = :eff_to, updated_at = NOW() "
                    f"WHERE id = :id"
                ), {"eff_to": str(new_eff_to) if new_eff_to else None, "id": keep_id})
                updated_count += 1

            # Delete redundant rows in chunks of 500
            deleted_count = 0
            chunk_size = 500
            for i in range(0, len(ids_to_delete), chunk_size):
                chunk = ids_to_delete[i:i + chunk_size]
                placeholders = ", ".join(f":id_{j}" for j in range(len(chunk)))
                params = {f"id_{j}": cid for j, cid in enumerate(chunk)}
                conn.execute(text(
                    f"DELETE FROM {table_name} WHERE id IN ({placeholders})"
                ), params)
                deleted_count += len(chunk)

            conn.commit()

            # Verify final count
            final_rows = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()

            print(f"\n  Rows before: {total_rows}")
            print(f"  Rows deleted: {deleted_count}")
            print(f"  Rows updated (effective_to extended): {updated_count}")
            print(f"  Rows after: {final_rows}")

            return {
                "table": table_name,
                "before": total_rows,
                "deleted": deleted_count,
                "updated": updated_count,
                "after": final_rows,
            }

    return {
        "table": table_name,
        "before": total_rows,
        "would_delete": total_rows_to_delete,
        "would_update": total_runs_to_consolidate,
        "after": rows_remaining,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"Consolidate Rates — {'DRY RUN' if DRY_RUN else 'LIVE RUN'}")
    print(f"DSN: {PG_DSN}")

    engine = create_engine(PG_DSN)
    results = []

    for table_config in TABLES:
        result = process_table(engine, table_config)
        results.append(result)

    # Combined summary
    print(f"\n{'=' * 60}")
    print("Combined Summary")
    print(f"{'=' * 60}")
    for r in results:
        print(f"\n  {r['table']}:")
        print(f"    Before: {r['before']}")
        if DRY_RUN:
            print(f"    Would delete: {r['would_delete']}")
            print(f"    Would update: {r['would_update']}")
            print(f"    After: {r['after']}")
        else:
            print(f"    Deleted: {r['deleted']}")
            print(f"    Updated: {r['updated']}")
            print(f"    After: {r['after']}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
