"""
scripts/openend_rates.py

Sets effective_to = NULL on the latest active rate row per card group in
local_charges and customs_rates, where effective_to = '2026-02-28'.

This corrects the data gap caused by the Datastore migration — the last
migrated month was Feb 2026, so all rates appear to expire on 2026-02-28.
Rates that are still current should be open-ended (effective_to = NULL).

Logic:
  For each card group, find the row with the latest effective_from that
  has effective_to = '2026-02-28' and is_active = TRUE.
  Set effective_to = NULL on that row only.

DRY_RUN = True by default. Set to False to execute real updates.

Usage (from project root C:\\dev\\af-cloud-v2):
    af-server\\.venv\\Scripts\\python.exe af-server/scripts/openend_rates.py
"""

from datetime import datetime, timezone

from sqlalchemy import create_engine, text

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DRY_RUN = False  # Set to False to execute real updates

PG_DSN = "postgresql+psycopg2://af_server:Afserver_2019@localhost:5432/accelefreight"

CUTOFF_DATE = "2026-02-28"  # The last migrated month end date

# ---------------------------------------------------------------------------
# Table definitions
# ---------------------------------------------------------------------------

TABLES = [
    {
        "name": "local_charges",
        "group_cols": [
            "port_code", "trade_direction", "shipment_type",
            "container_size", "container_type", "charge_code", "is_domestic",
        ],
    },
    {
        "name": "customs_rates",
        "group_cols": [
            "port_code", "trade_direction", "shipment_type",
            "charge_code", "is_domestic",
        ],
    },
]

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def process_table(conn, table: dict, dry_run: bool) -> dict:
    name = table["name"]
    group_cols = table["group_cols"]
    cols_csv = ", ".join(group_cols)

    # Find the id of the latest-effective_from row per card group
    # where effective_to = CUTOFF_DATE and is_active = TRUE.
    # These are the rows that should be open-ended.
    rows = conn.execute(text(f"""
        SELECT DISTINCT ON ({cols_csv})
            id, {cols_csv}, effective_from, effective_to
        FROM {name}
        WHERE effective_to = :cutoff
          AND is_active = TRUE
        ORDER BY {cols_csv}, effective_from DESC
    """), {"cutoff": CUTOFF_DATE}).fetchall()

    ids_to_update = [r[0] for r in rows]
    count = len(ids_to_update)

    if dry_run:
        print(f"\n=== {name} (DRY RUN) ===")
        print(f"  Rows that would be open-ended: {count}")
        if rows:
            print(f"  Sample (first 10):")
            for r in rows[:10]:
                print(f"    id={r[0]}  eff_from={r[-2]}  eff_to={r[-1]}")
    else:
        now = datetime.now(timezone.utc).isoformat()
        # Update in batches of 500
        updated = 0
        batch_size = 500
        for i in range(0, len(ids_to_update), batch_size):
            batch = ids_to_update[i:i + batch_size]
            conn.execute(text(f"""
                UPDATE {name}
                SET effective_to = NULL,
                    updated_at = :now
                WHERE id = ANY(:ids)
            """), {"ids": batch, "now": now})
            updated += len(batch)
        conn.commit()

        print(f"\n=== {name} ===")
        print(f"  Rows open-ended: {updated}")

    return {"table": name, "count": count}


def main():
    engine = create_engine(PG_DSN)
    results = []

    print(f"Open-End Rates — {'DRY RUN' if DRY_RUN else 'LIVE RUN'}")
    print(f"Cutoff date: {CUTOFF_DATE}\n")

    with engine.connect() as conn:
        for table in TABLES:
            result = process_table(conn, table, DRY_RUN)
            results.append(result)

    print(f"\n{'=' * 60}")
    print(f"Summary ({'DRY RUN' if DRY_RUN else 'LIVE'}):")
    for r in results:
        label = "Would update" if DRY_RUN else "Updated"
        print(f"  {r['table']}: {label} {r['count']} rows → effective_to = NULL")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
