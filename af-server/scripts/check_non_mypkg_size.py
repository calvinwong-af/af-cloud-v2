"""
Size check: non-MYPKG/MYPKG_N haulage rate rows available for migration.
Reads PricingHaulage cards to get pt_ids for non-MYPKG ports,
then counts matching rate rows in the 150K dataset (in-memory filter).
"""
import os
import sys
from collections import defaultdict
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google.cloud import datastore
from google.cloud.datastore.query import PropertyFilter

PROJECT_ID = 'cloud-accele-freight'
KIND_PRICING_HAULAGE = 'PricingHaulage'
KIND_MONTHLY_RATE = 'PTMonthlyRateHaulageTransport'
PT_HAULAGE = 'PT-HAULAGE'
CUTOFF_DATE = date(2025, 1, 1)

_MONTH_MAP = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}

def parse_month_year(my):
    if not my or "-" not in my:
        return None
    parts = my.strip().upper().split("-")
    if len(parts) != 2:
        return None
    m = _MONTH_MAP.get(parts[0])
    if not m:
        return None
    try:
        return date(int(parts[1]), m, 1)
    except ValueError:
        return None

key_file = os.path.join(os.path.dirname(__file__), '..', 'cloud-accele-freight-key.json')
if os.path.exists(key_file):
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.abspath(key_file)

ds = datastore.Client(project=PROJECT_ID)

# ── Step 1: Get pt_ids for non-MYPKG cards ──────────────────────────────────
print("=== Step 1: PricingHaulage cards (non-MYPKG) ===")
query = ds.query(kind=KIND_PRICING_HAULAGE)
all_cards = list(query.fetch())
print(f"  Total cards: {len(all_cards)}")

EXCLUDE_PORTS = {"MYPKG", "MYPKG_N"}

non_mypkg_pt_ids: set[int] = set()
non_mypkg_port_counts: dict[str, int] = defaultdict(int)

for card in all_cards:
    port = (card.get("port_un_code") or "").strip()
    if port in EXCLUDE_PORTS:
        continue
    pt_id = card.key.id_or_name
    if pt_id:
        non_mypkg_pt_ids.add(int(pt_id))
        non_mypkg_port_counts[port] += 1

print(f"  Non-MYPKG cards: {len(non_mypkg_pt_ids)}")
print(f"\n  By port:")
for port in sorted(non_mypkg_port_counts):
    print(f"    {port}: {non_mypkg_port_counts[port]}")

# ── Step 2: Fetch all rate rows, count non-MYPKG 2024+ rows ─────────────────
print("\n=== Step 2: Rate row size check ===")
query2 = ds.query(kind=KIND_MONTHLY_RATE)
query2.add_filter(filter=PropertyFilter("kind", "=", PT_HAULAGE))
print("  Fetching all PT-HAULAGE entities...")
all_entities = list(query2.fetch())
print(f"  Total fetched: {len(all_entities)}")

total = 0
pre_cutoff = 0
no_card = 0
list_price = 0
supplier_cost = 0
supplier_counts: dict[str, int] = defaultdict(int)

for e in all_entities:
    pt_id_raw = e.get("pt_id")
    try:
        pt_id = int(pt_id_raw)
    except (TypeError, ValueError):
        continue

    if pt_id not in non_mypkg_pt_ids:
        continue

    effective_from = parse_month_year(e.get("month_year", ""))
    if not effective_from:
        continue
    if effective_from < CUTOFF_DATE:
        pre_cutoff += 1
        continue

    total += 1
    is_price = bool(e.get("is_price", False))
    if is_price:
        list_price += 1
    else:
        sid = e.get("supplier_id") or "NO_SUPPLIER_ID"
        supplier_cost += 1
        supplier_counts[sid] += 1

print(f"\n  Non-MYPKG rows matching 2024+ cutoff: {total}")
print(f"    List price rows: {list_price}")
print(f"    Supplier cost rows: {supplier_cost}")
print(f"    Pre-{CUTOFF_DATE.year} skipped: {pre_cutoff}")
print(f"\n  Suppliers on non-MYPKG cost rows:")
for sid, cnt in sorted(supplier_counts.items(), key=lambda x: -x[1]):
    print(f"    {sid}: {cnt}")
