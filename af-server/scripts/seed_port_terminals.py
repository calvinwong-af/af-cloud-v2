"""
scripts/seed_port_terminals.py

Seeds the Port Kind with terminal support:
- Adds terminals array + has_terminals flag to Port Klang (MYPKG)
- Backfills has_terminals=False, terminals=[] on all other ports missing these fields

Idempotent — safe to run multiple times.
Run with: python -m scripts.seed_port_terminals
"""

import sys

sys.path.insert(0, ".")

from core.datastore import get_client


# Terminal definitions for Port Klang
MYPKG_TERMINALS = [
    {
        "terminal_id": "MYPKG_W",
        "name": "Westports",
        "is_default": True,
    },
    {
        "terminal_id": "MYPKG_N",
        "name": "Northport",
        "is_default": False,
    },
]


def main():
    client = get_client()
    updated = 0
    skipped = 0

    # --- Seed Port Klang terminals ---
    print("Seeding Port Klang (MYPKG) terminals...", flush=True)
    mypkg_key = client.key("Port", "MYPKG")
    mypkg = client.get(mypkg_key)

    if not mypkg:
        print("  ERROR: MYPKG not found in Port Kind. Cannot seed terminals.")
        return

    existing_terminals = mypkg.get("terminals", [])
    existing_ids = {t.get("terminal_id") for t in existing_terminals} if existing_terminals else set()
    target_ids = {t["terminal_id"] for t in MYPKG_TERMINALS}

    if existing_ids == target_ids and mypkg.get("has_terminals") is True:
        print("  MYPKG already has correct terminals. Skipping.")
        skipped += 1
    else:
        mypkg["has_terminals"] = True
        mypkg["terminals"] = MYPKG_TERMINALS
        client.put(mypkg)
        print(f"  MYPKG updated: has_terminals=True, {len(MYPKG_TERMINALS)} terminals")
        updated += 1

    # --- Backfill has_terminals + terminals on all other ports ---
    print("\nBackfilling has_terminals/terminals on remaining ports...", flush=True)
    port_query = client.query(kind="Port")
    for entity in port_query.fetch():
        key_name = entity.key.name or entity.key.id
        if key_name == "MYPKG":
            continue  # Already handled

        needs_update = False
        if "has_terminals" not in entity:
            entity["has_terminals"] = False
            needs_update = True
        if "terminals" not in entity:
            entity["terminals"] = []
            needs_update = True

        if needs_update:
            client.put(entity)
            updated += 1
        else:
            skipped += 1

    print(f"\nDone. Updated: {updated}, Skipped (already correct): {skipped}")


if __name__ == "__main__":
    main()
