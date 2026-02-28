"""
scripts/migrate_v1_port_codes.py

Migrates V1 non-standard port codes (e.g. MYPKG_N) to standard UN code + terminal_id pairs.

For each record with a non-standard port code:
  - origin_port_un_code: "MYPKG_N"  →  "MYPKG" + origin_terminal_id: "MYPKG_N"
  - destination_port_un_code: "MYPKG_N"  →  "MYPKG" + destination_terminal_id: "MYPKG_N"

Idempotent: records with _migrated_port_codes=True are skipped.

Usage:
  python -m scripts.migrate_v1_port_codes --dry-run   # preview
  python -m scripts.migrate_v1_port_codes              # execute
"""

import re
import sys

sys.path.insert(0, ".")

from core.datastore import get_client


STANDARD_PATTERN = re.compile(r"^[A-Z]{2}[A-Z0-9]{3}$")

# Map of non-standard suffixes to terminal_id generators
SUFFIX_TO_TERMINAL = {
    "_N": lambda base: f"{base}_N",   # North terminal
    "_W": lambda base: f"{base}_W",   # West terminal
    "_S": lambda base: f"{base}_S",   # South terminal
    "_E": lambda base: f"{base}_E",   # East terminal
    "_2": lambda base: f"{base}_2",   # Secondary terminal
}


def parse_non_standard(code: str) -> tuple[str, str] | None:
    """
    If code is non-standard, return (base_un_code, terminal_id).
    Returns None if code is already standard.
    """
    if STANDARD_PATTERN.match(code):
        return None
    for suffix, terminal_fn in SUFFIX_TO_TERMINAL.items():
        if code.endswith(suffix):
            base = code[: -len(suffix)]
            if STANDARD_PATTERN.match(base):
                return base, terminal_fn(base)
    return None


def migrate_entity(entity, dry_run: bool) -> str:
    """
    Check and migrate port codes on a single entity.
    Returns: 'updated', 'skipped', or 'no_change'.
    """
    if entity.get("_migrated_port_codes"):
        return "skipped"

    changed = False

    # Check origin
    origin = entity.get("origin_port_un_code")
    if origin and isinstance(origin, str):
        parsed = parse_non_standard(origin.strip().upper())
        if parsed:
            base, terminal_id = parsed
            if dry_run:
                key_name = entity.key.name or entity.key.id
                print(f"    [DRY-RUN] {key_name}: origin {origin} → {base} + terminal_id={terminal_id}")
            else:
                entity["origin_port_un_code"] = base
                entity["origin_terminal_id"] = terminal_id
            changed = True

    # Check destination
    dest = entity.get("destination_port_un_code")
    if dest and isinstance(dest, str):
        parsed = parse_non_standard(dest.strip().upper())
        if parsed:
            base, terminal_id = parsed
            if dry_run:
                key_name = entity.key.name or entity.key.id
                print(f"    [DRY-RUN] {key_name}: destination {dest} → {base} + terminal_id={terminal_id}")
            else:
                entity["destination_port_un_code"] = base
                entity["destination_terminal_id"] = terminal_id
            changed = True

    if changed:
        if not dry_run:
            entity["_migrated_port_codes"] = True
            # Don't put yet — caller batches
        return "updated"

    return "no_change"


def main():
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("=== DRY RUN MODE — no writes will be made ===\n")
    else:
        print("=== LIVE MODE — writing to Datastore ===\n")

    client = get_client()

    total_updated = 0
    total_skipped = 0
    total_no_change = 0
    errors = 0

    for kind_name in ("Quotation", "ShipmentOrder"):
        print(f"Scanning {kind_name}...", flush=True)
        query = client.query(kind=kind_name)
        batch_to_put = []

        for entity in query.fetch():
            try:
                result = migrate_entity(entity, dry_run)
                if result == "updated":
                    total_updated += 1
                    if not dry_run:
                        batch_to_put.append(entity)
                        # Write in batches of 100
                        if len(batch_to_put) >= 100:
                            client.put_multi(batch_to_put)
                            batch_to_put = []
                elif result == "skipped":
                    total_skipped += 1
                else:
                    total_no_change += 1
            except Exception as e:
                key_name = entity.key.name or entity.key.id
                print(f"  ERROR on {key_name}: {e}")
                errors += 1

        # Flush remaining batch
        if batch_to_put and not dry_run:
            client.put_multi(batch_to_put)

        print(f"  {kind_name} done.", flush=True)

    print(f"\n{'DRY RUN ' if dry_run else ''}Summary:")
    print(f"  Records updated:    {total_updated}")
    print(f"  Records skipped:    {total_skipped} (already migrated)")
    print(f"  Records no change:  {total_no_change} (standard codes)")
    print(f"  Errors:             {errors}")


if __name__ == "__main__":
    main()
