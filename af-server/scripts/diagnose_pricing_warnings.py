"""
scripts/diagnose_pricing_warnings.py

Read-only diagnostic — reports on PTMonthlyRateOceanAir records that are
missing currency or uom fields, broken down by month_year and kind.

Helps assess scope of data quality issues before running full migration.

Usage:
    cd af-server
    .venv/Scripts/python scripts/diagnose_pricing_warnings.py
"""

import sys
import os
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

from google.cloud import datastore

_MONTH_MAP = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}

def _year_month_sort_key(month_year: str) -> tuple:
    if not month_year or "-" not in month_year:
        return (9999, 99)
    parts = month_year.strip().upper().split("-")
    if len(parts) != 2:
        return (9999, 99)
    month_num = _MONTH_MAP.get(parts[0], 99)
    try:
        year = int(parts[1])
    except ValueError:
        year = 9999
    return (year, month_num)


def main():
    ds_client = datastore.Client()

    # ── Port code audit ──────────────────────────────────────────────────────
    print("Fetching PricingFCL + PricingLCL for port code audit...")
    fcl_entities = list(ds_client.query(kind="PricingFCL").fetch())
    lcl_entities = list(ds_client.query(kind="PricingLCL").fetch())

    non_standard_ports: dict[str, set[str]] = {}  # port_code → set of rate_card_keys
    for e in fcl_entities + lcl_entities:
        if e.get("trash", False):
            continue
        for field in ("port_origin_un_code", "port_destination_un_code"):
            code = e.get(field, "")
            if code and ("_" in code or len(code) > 5):
                if code not in non_standard_ports:
                    non_standard_ports[code] = set()
                non_standard_ports[code].add(e.get("pt_id", "?"))

    if non_standard_ports:
        print(f"\n{'─' * 55}")
        print(f"Non-standard port codes in rate card definitions")
        print(f"(codes with underscores or length > 5 — likely legacy variants)")
        print(f"{'─' * 55}")
        for code in sorted(non_standard_ports.keys()):
            print(f"  {code:<15} — {len(non_standard_ports[code])} rate cards")
    else:
        print("  ✅ All port codes in rate cards are standard UN/LOCODE format.")

    # ── Rate history warnings ─────────────────────────────────────────────────
    print("\nFetching PTMonthlyRateOceanAir from Datastore...")
    query = ds_client.query(kind="PTMonthlyRateOceanAir")
    entities = list(query.fetch())
    print(f"Total records: {len(entities)}\n")

    # Counters
    missing_currency_by_month: dict[str, int] = defaultdict(int)
    missing_uom_by_month: dict[str, int] = defaultdict(int)
    missing_both_by_month: dict[str, int] = defaultdict(int)
    kind_breakdown: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    total_missing_currency = 0
    total_missing_uom = 0
    clean = 0

    for e in entities:
        month_year = e.get("month_year", "UNKNOWN")
        kind = e.get("kind", "UNKNOWN")
        currency = e.get("currency") or ""
        uom = e.get("uom") or ""

        has_currency_issue = not currency
        has_uom_issue = not uom

        if has_currency_issue:
            missing_currency_by_month[month_year] += 1
            kind_breakdown[month_year][kind] += 1
            total_missing_currency += 1
        if has_uom_issue:
            missing_uom_by_month[month_year] += 1
            total_missing_uom += 1
        if has_currency_issue and has_uom_issue:
            missing_both_by_month[month_year] += 1
        if not has_currency_issue and not has_uom_issue:
            clean += 1

    # Report — missing currency (the important one)
    print(f"{'─' * 55}")
    print(f"Records missing CURRENCY — {total_missing_currency} total")
    print(f"{'─' * 55}")
    sorted_months = sorted(missing_currency_by_month.keys(), key=_year_month_sort_key)
    for month in sorted_months:
        count = missing_currency_by_month[month]
        kinds = dict(kind_breakdown[month])
        print(f"  {month:<12} {count:>5}   {kinds}")

    print(f"\n{'─' * 55}")
    print(f"Records missing UOM — {total_missing_uom} total")
    print(f"{'─' * 55}")
    sorted_months_uom = sorted(missing_uom_by_month.keys(), key=_year_month_sort_key)
    for month in sorted_months_uom:
        count = missing_uom_by_month[month]
        print(f"  {month:<12} {count:>5}")

    print(f"\n{'─' * 55}")
    print(f"Summary")
    print(f"{'─' * 55}")
    print(f"  Total records:           {len(entities)}")
    print(f"  Clean (no issues):       {clean}")
    print(f"  Missing currency:        {total_missing_currency}")
    print(f"  Missing uom:             {total_missing_uom}")
    print(f"  Missing both:            {sum(missing_both_by_month.values())}")
    print()


if __name__ == "__main__":
    main()
