"""
scripts/cleanup_dg_class_charges.py

DG Class Charges data cleanup:
  - For each card group (port/direction/type/size/ctype/dg_class/charge/domestic),
    find the earliest effective_from row.
  - Delete all subsequent rows that are exact duplicates (same price + cost).
  - Set effective_to = NULL on the surviving earliest row.

DRY_RUN = True  → print what would happen, no DB changes.
DRY_RUN = False → apply changes.
"""

import os
import sys
from decimal import Decimal

import psycopg2
from dotenv import load_dotenv

DRY_RUN = True

# ---------------------------------------------------------------------------
# DB connection
# ---------------------------------------------------------------------------

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

PG_DSN = (
    f"host=localhost port=5432 dbname=accelefreight "
    f"user=af_server password=Afserver_2019"
)


def get_conn():
    conn = psycopg2.connect(PG_DSN)
    conn.autocommit = False
    return conn


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    conn = get_conn()
    cur = conn.cursor()

    # Fetch all rows ordered by card group + effective_from ASC
    cur.execute("""
        SELECT id, port_code, trade_direction, shipment_type,
               container_size, container_type, dg_class_code,
               charge_code, is_domestic,
               price, cost,
               effective_from, effective_to
        FROM dg_class_charges
        ORDER BY
            port_code, trade_direction, shipment_type,
            container_size, container_type, dg_class_code,
            charge_code, is_domestic,
            effective_from ASC
    """)
    rows = cur.fetchall()

    print(f"Total rows fetched: {len(rows)}")

    # Group by card key
    from collections import defaultdict
    groups = defaultdict(list)
    for row in rows:
        (id_, port, direction, stype, csize, ctype, dg, charge, domestic,
         price, cost, eff_from, eff_to) = row
        key = (port, direction, stype, csize, ctype, dg, charge, domestic)
        groups[key].append({
            "id": id_,
            "price": price,
            "cost": cost,
            "effective_from": eff_from,
            "effective_to": eff_to,
        })

    print(f"Unique card groups: {len(groups)}")

    ids_to_delete = []
    ids_to_clear_eff_to = []

    for key, card_rows in groups.items():
        if len(card_rows) == 1:
            # Single row — just clear effective_to
            r = card_rows[0]
            if r["effective_to"] is not None:
                ids_to_clear_eff_to.append(r["id"])
            continue

        # Earliest row = first in list (sorted ASC)
        earliest = card_rows[0]
        base_price = earliest["price"]
        base_cost = earliest["cost"]

        # Clear effective_to on earliest regardless
        if earliest["effective_to"] is not None:
            ids_to_clear_eff_to.append(earliest["id"])

        # Check subsequent rows — delete if price+cost match earliest
        for later in card_rows[1:]:
            later_price = later["price"]
            later_cost = later["cost"]

            # Compare as Decimal to avoid float drift
            if (
                Decimal(str(later_price)).quantize(Decimal("0.01")) ==
                Decimal(str(base_price)).quantize(Decimal("0.01"))
                and
                Decimal(str(later_cost)).quantize(Decimal("0.01")) ==
                Decimal(str(base_cost)).quantize(Decimal("0.01"))
            ):
                ids_to_delete.append(later["id"])
                print(f"  DELETE id={later['id']} "
                      f"({key[0]}/{key[1]}/{key[2]}/{key[5]}/{key[6]}) "
                      f"eff_from={later['effective_from']} "
                      f"price={later_price} cost={later_cost}")
            else:
                # Different price/cost — keep but still clear effective_to
                if later["effective_to"] is not None:
                    ids_to_clear_eff_to.append(later["id"])
                print(f"  KEEP   id={later['id']} "
                      f"({key[0]}/{key[1]}/{key[2]}/{key[5]}/{key[6]}) "
                      f"eff_from={later['effective_from']} "
                      f"price={later_price} cost={later_cost} — different rate, kept")

    # Remove deleted IDs from clear list
    delete_set = set(ids_to_delete)
    ids_to_clear_eff_to = [i for i in ids_to_clear_eff_to if i not in delete_set]

    print(f"\nSummary:")
    print(f"  Rows to DELETE (duplicate price+cost):  {len(ids_to_delete)}")
    print(f"  Rows to clear effective_to (→ NULL):    {len(ids_to_clear_eff_to)}")

    if DRY_RUN:
        print("\nDRY RUN — no changes applied.")
        conn.close()
        return

    # Apply changes
    if ids_to_delete:
        cur.execute(
            "DELETE FROM dg_class_charges WHERE id = ANY(%s)",
            (ids_to_delete,)
        )
        print(f"Deleted {cur.rowcount} rows.")

    if ids_to_clear_eff_to:
        cur.execute(
            "UPDATE dg_class_charges SET effective_to = NULL WHERE id = ANY(%s)",
            (ids_to_clear_eff_to,)
        )
        print(f"Cleared effective_to on {cur.rowcount} rows.")

    conn.commit()
    print("Done.")
    conn.close()


if __name__ == "__main__":
    main()
