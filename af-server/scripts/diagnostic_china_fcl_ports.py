"""
scripts/diagnostic_china_fcl_ports.py

Lists all distinct China origin ports (CN*) from PricingFCL entities in Datastore,
along with card count and trash status breakdown.

Usage:
    cd af-server
    .venv/Scripts/python scripts/diagnostic_china_fcl_ports.py
"""

import sys
import os
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

from google.cloud import datastore

def main():
    ds_client = datastore.Client()

    print("Fetching PricingFCL entities from Datastore...")
    entities = list(ds_client.query(kind="PricingFCL").fetch())
    print(f"Total PricingFCL entities: {len(entities)}\n")

    # Breakdown by origin port code
    active: dict[str, int] = defaultdict(int)
    trashed: dict[str, int] = defaultdict(int)

    for e in entities:
        origin = e.get("port_origin_un_code", "UNKNOWN")
        if e.get("trash", False):
            trashed[origin] += 1
        else:
            active[origin] += 1

    # Filter to CN origins only
    cn_active = {k: v for k, v in active.items() if k.startswith("CN")}
    cn_trashed = {k: v for k, v in trashed.items() if k.startswith("CN")}
    all_cn = sorted(set(list(cn_active.keys()) + list(cn_trashed.keys())))

    print(f"{'Port':<12} {'Active':>8} {'Trashed':>9} {'Total':>8}")
    print("-" * 42)
    for port in all_cn:
        a = cn_active.get(port, 0)
        t = cn_trashed.get(port, 0)
        print(f"{port:<12} {a:>8} {t:>9} {a+t:>8}")

    print("-" * 42)
    total_a = sum(cn_active.values())
    total_t = sum(cn_trashed.values())
    print(f"{'TOTAL':<12} {total_a:>8} {total_t:>9} {total_a+total_t:>8}")

    print(f"\nAll active origin ports in Datastore (non-CN):")
    non_cn = sorted(k for k in active if not k.startswith("CN"))
    for port in non_cn:
        print(f"  {port:<12} {active[port]:>6} cards")

if __name__ == "__main__":
    main()
