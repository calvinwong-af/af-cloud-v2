"""
scripts/audit_port_codes.py

Audits all distinct port codes used across V1 Quotation and ShipmentOrder records.
Outputs a frequency table and flags non-standard codes with three categories:
  [STANDARD]        — valid 5-char UN/LOCODE
  [TERMINAL SUFFIX] — has known suffix (_N/_W/_S/_E/_2), base is standard
  [IATA/NON-LOCODE] — 3-letter or other non-standard, no base inferable

V1 ShipmentOrder records store ports as nested ENTITY objects:
  origin:      {"type": "SEA", "port_un_code": "MYPKG_N"}
  destination: {"type": "SEA", "port_un_code": "MYTWU"}

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

# IATA airport code pattern: exactly 3 uppercase alpha
IATA_PATTERN = re.compile(r"^[A-Z]{3}$")

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


def classify_code(code: str) -> tuple[str, str | None]:
    """
    Classify a port code into one of three categories.
    Returns (category, base_code_or_None).
    """
    if STANDARD_PATTERN.match(code):
        return "[STANDARD]", None

    base = infer_base_code(code)
    if base:
        return "[TERMINAL SUFFIX]", base

    return "[IATA/NON-LOCODE]", None


def extract_port_codes(entity) -> list[str]:
    """
    Extract port codes from a Datastore entity.
    V1 records store ports as nested objects: origin.port_un_code / destination.port_un_code
    Some older records may use flat string fields as fallback.
    """
    codes = []

    # Primary: nested origin/destination objects (V1 ShipmentOrder structure)
    for field in ("origin", "destination"):
        val = entity.get(field)
        if isinstance(val, dict):
            code = val.get("port_un_code")
            if code and isinstance(code, str) and code.strip():
                codes.append(code.strip().upper())

    # Fallback: flat string fields (older records or Quotation kind)
    for field in ("origin_port_un_code", "destination_port_un_code",
                  "origin_port", "destination_port",
                  "port_of_loading", "port_of_discharge"):
        val = entity.get(field)
        if val and isinstance(val, str) and val.strip():
            code = val.strip().upper()
            if code not in codes:  # avoid double-counting
                codes.append(code)

    return codes


def main():
    client = get_client()
    port_counter: Counter[str] = Counter()
    total_records = 0

    # --- Scan Quotation Kind ---
    print("Scanning Quotation Kind...", flush=True)
    q_query = client.query(kind="Quotation")
    for entity in q_query.fetch():
        total_records += 1
        for code in extract_port_codes(entity):
            port_counter[code] += 1

    print(f"  Quotation records scanned: {total_records}", flush=True)

    # --- Scan ShipmentOrder Kind ---
    so_count = 0
    print("Scanning ShipmentOrder Kind...", flush=True)
    so_query = client.query(kind="ShipmentOrder")
    for entity in so_query.fetch():
        so_count += 1
        total_records += 1
        for code in extract_port_codes(entity):
            port_counter[code] += 1

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
    classifications: dict[str, tuple[int, str, str | None]] = {}
    for code, count in port_counter.items():
        category, base = classify_code(code)
        classifications[code] = (count, category, base)

    distinct_count = len(port_counter)
    standard_count = sum(1 for _, (_, cat, _) in classifications.items() if cat == "[STANDARD]")
    terminal_count = sum(1 for _, (_, cat, _) in classifications.items() if cat == "[TERMINAL SUFFIX]")
    iata_count = sum(1 for _, (_, cat, _) in classifications.items() if cat == "[IATA/NON-LOCODE]")

    # --- Output ---
    print()
    print("=" * 60)
    print("=== PORT CODE AUDIT ===")
    print("=" * 60)
    print(f"Total records scanned: {total_records:,}")
    print(f"Distinct codes:        {distinct_count}")
    print(f"  [STANDARD]           {standard_count}")
    print(f"  [TERMINAL SUFFIX]    {terminal_count}")
    print(f"  [IATA/NON-LOCODE]    {iata_count}")
    print()

    print("--- All Codes (by frequency) ---")
    for code, count in port_counter.most_common():
        _, category, base = classifications[code]
        in_port_kind = "✓" if code in port_kind_codes else "✗"
        base_str = f"  base={base}" if base else ""
        print(f"  {code:<16} {count:>5}   {category:<20} Port Kind: {in_port_kind}{base_str}")

    # --- Terminal Suffix codes ---
    terminal_codes = {c: v for c, v in classifications.items() if v[1] == "[TERMINAL SUFFIX]"}
    if terminal_codes:
        print()
        print("--- Terminal Suffix Codes ---")
        for code in sorted(terminal_codes, key=lambda c: -terminal_codes[c][0]):
            count, _, base = terminal_codes[code]
            base_exists = base in port_kind_codes if base else False
            base_status = "(exists)" if base_exists else "(NOT in Port Kind)"
            print(f"  {code:<16} {count:>5}   base: {base} {base_status}")

    # --- IATA / Non-LOCODE codes ---
    iata_codes = {c: v for c, v in classifications.items() if v[1] == "[IATA/NON-LOCODE]"}
    if iata_codes:
        print()
        print("--- IATA / Non-LOCODE Codes ---")
        for code in sorted(iata_codes, key=lambda c: -iata_codes[c][0]):
            count, _, _ = iata_codes[code]
            print(f"  {code:<16} {count:>5}")

    print()
    print("Audit complete.")


if __name__ == "__main__":
    main()
