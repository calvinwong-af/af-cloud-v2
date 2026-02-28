"""
scripts/audit_port_codes.py

Audits all distinct port codes used across V1 Quotation and ShipmentOrder records.
Outputs a frequency table and flags any non-standard codes (not 5 alpha chars).
Run with: python -m scripts.audit_port_codes
"""

import re
import sys
from collections import Counter

# Add parent dir to path so core imports work
sys.path.insert(0, ".")

from core.datastore import get_client


# Standard UN/LOCODE pattern: 2 alpha country + 3 alphanumeric location
STANDARD_PATTERN = re.compile(r"^[A-Z]{2}[A-Z0-9]{3}$")

# Known suffixes that indicate terminal sub-codes
KNOWN_SUFFIXES = ["_N", "_S", "_E", "_W", "_2"]


def infer_base_code(code: str) -> str | None:
    """Try to strip known suffixes to find a standard base UN code."""
    for suffix in KNOWN_SUFFIXES:
        if code.endswith(suffix):
            base = code[: -len(suffix)]
            if STANDARD_PATTERN.match(base):
                return base
    return None


def main():
    client = get_client()
    port_counter: Counter[str] = Counter()
    total_records = 0

    # Fields to check for port codes
    port_fields = [
        "origin_port_un_code",
        "destination_port_un_code",
        "origin_port",
        "destination_port",
        "port_of_loading",
        "port_of_discharge",
    ]

    # --- Scan Quotation Kind ---
    print("Scanning Quotation Kind...", flush=True)
    q_query = client.query(kind="Quotation")
    for entity in q_query.fetch():
        total_records += 1
        for field in port_fields:
            val = entity.get(field)
            if val and isinstance(val, str) and val.strip():
                port_counter[val.strip().upper()] += 1

    print(f"  Quotation records scanned: {total_records}", flush=True)

    # --- Scan ShipmentOrder Kind ---
    so_count = 0
    print("Scanning ShipmentOrder Kind...", flush=True)
    so_query = client.query(kind="ShipmentOrder")
    for entity in so_query.fetch():
        so_count += 1
        total_records += 1
        for field in port_fields:
            val = entity.get(field)
            if val and isinstance(val, str) and val.strip():
                port_counter[val.strip().upper()] += 1

    print(f"  ShipmentOrder records scanned: {so_count}", flush=True)

    # --- Check which base codes exist in Port Kind ---
    port_kind_codes: set[str] = set()
    port_query = client.query(kind="Port")
    port_query.keys_only()
    for entity in port_query.fetch():
        key_name = entity.key.name or entity.key.id
        if key_name:
            port_kind_codes.add(str(key_name))

    # --- Classify codes ---
    non_standard: dict[str, tuple[int, str | None]] = {}
    for code, count in port_counter.items():
        if not STANDARD_PATTERN.match(code):
            base = infer_base_code(code)
            base_exists = base in port_kind_codes if base else False
            non_standard[code] = (count, f"{base} {'(exists)' if base_exists else '(NOT in Port Kind)'}" if base else None)

    distinct_count = len(port_counter)
    non_standard_count = len(non_standard)

    # --- Output ---
    print()
    print("=" * 50)
    print("=== PORT CODE AUDIT ===")
    print("=" * 50)
    print(f"Total records scanned: {total_records:,}")
    print(f"Distinct codes: {distinct_count}")
    print(f"Non-standard codes: {non_standard_count}")
    print()

    print("--- All Codes (by frequency) ---")
    for code, count in port_counter.most_common():
        flag = "[NON-STANDARD]" if code in non_standard else "[STANDARD]"
        in_port_kind = "✓" if code in port_kind_codes else "✗"
        print(f"  {code:<16} {count:>5}   {flag}  Port Kind: {in_port_kind}")

    if non_standard:
        print()
        print("--- Non-Standard Codes ---")
        for code in sorted(non_standard, key=lambda c: -non_standard[c][0]):
            count, base_info = non_standard[code]
            base_str = f"  (base: {base_info})" if base_info else "  (no base inferred)"
            print(f"  {code:<16} {count:>5}{base_str}")

    print()
    print("Audit complete.")


if __name__ == "__main__":
    main()
