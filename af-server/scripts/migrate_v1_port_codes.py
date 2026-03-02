"""
scripts/migrate_v1_port_codes.py

Migrates V1 Datastore port codes to standard UN code + terminal_id pairs.

Logic:
  - MYPKG_N → base=MYPKG, terminal=MYPKG_N
  - MYPKG (no suffix) → base=MYPKG, terminal=MYPKG_W (explicit Westports)
  - Other _N/_W/_S/_E/_2 suffixes → parse normally
  - Standard codes with no known terminal → terminal_id unset

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

# Ports with known terminals — standard codes that need explicit terminal assignment
KNOWN_TERMINAL_PORTS = {
    "MYPKG": "MYPKG_W",  # Westports is the default terminal
}

# Map of non-standard suffixes to terminal_id generators
SUFFIX_TO_TERMINAL = {
    "_N": lambda base: f"{base}_N",
    "_W": lambda base: f"{base}_W",
    "_S": lambda base: f"{base}_S",
    "_E": lambda base: f"{base}_E",
    "_2": lambda base: f"{base}_2",
}


def parse_port_code(code: str) -> tuple[str, str | None]:
    """
    Parse a port code into (base_un_code, terminal_id).
    Returns terminal_id=None if no terminal applies.
    """
    code = code.strip().upper()

    # Check non-standard suffix first (e.g. MYPKG_N)
    for suffix, terminal_fn in SUFFIX_TO_TERMINAL.items():
        if code.endswith(suffix):
            base = code[: -len(suffix)]
            if STANDARD_PATTERN.match(base):
                return base, terminal_fn(base)

    # Standard code — check if it has a known default terminal
    if STANDARD_PATTERN.match(code):
        terminal = KNOWN_TERMINAL_PORTS.get(code)
        return code, terminal

    # Unrecognised format — return as-is with no terminal
    return code, None


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
        base, terminal_id = parse_port_code(origin)
        needs_update = (base != origin) or (terminal_id is not None)
        if needs_update:
            if dry_run:
                key_name = entity.key.name or entity.key.id
                t_str = f" + terminal_id={terminal_id}" if terminal_id else ""
                print(f"    [DRY-RUN] {key_name}: origin {origin} → {base}{t_str}")
            else:
                entity["origin_port_un_code"] = base
                if terminal_id:
                    entity["origin_terminal_id"] = terminal_id
            changed = True

    # Check destination
    dest = entity.get("destination_port_un_code")
    if dest and isinstance(dest, str):
        base, terminal_id = parse_port_code(dest)
        needs_update = (base != dest) or (terminal_id is not None)
        if needs_update:
            if dry_run:
                key_name = entity.key.name or entity.key.id
                t_str = f" + terminal_id={terminal_id}" if terminal_id else ""
                print(f"    [DRY-RUN] {key_name}: destination {dest} → {base}{t_str}")
            else:
                entity["destination_port_un_code"] = base
                if terminal_id:
                    entity["destination_terminal_id"] = terminal_id
            changed = True

    if changed:
        if not dry_run:
            entity["_migrated_port_codes"] = True
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
    print(f"  Records no change:  {total_no_change} (standard codes, no terminal)")
    print(f"  Errors:             {errors}")


if __name__ == "__main__":
    main()
