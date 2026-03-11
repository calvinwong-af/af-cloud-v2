"""
Check MYPKG suppliers:
1. List suppliers on PricingHaulage cards for MYPKG (card-level)
2. Sample supplier_id values on PT-HAULAGE rate rows
"""
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google.cloud import datastore
from google.cloud.datastore.query import PropertyFilter

PROJECT_ID = 'cloud-accele-freight'
KIND_PRICING_HAULAGE = 'PricingHaulage'
KIND_MONTHLY_RATE = 'PTMonthlyRateHaulageTransport'
PT_HAULAGE = 'PT-HAULAGE'

_MONTH_MAP = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}

key_file = os.path.join(os.path.dirname(__file__), '..', 'cloud-accele-freight-key.json')
if os.path.exists(key_file):
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.abspath(key_file)

ds = datastore.Client(project=PROJECT_ID)

# ── Part 1: PricingHaulage cards for MYPKG ──────────────────────────────────
print("=== Part 1: PricingHaulage cards for MYPKG ===")
query = ds.query(kind=KIND_PRICING_HAULAGE)
query.add_filter(filter=PropertyFilter("port_un_code", "=", "MYPKG"))
mypkg_cards = list(query.fetch())
print(f"MYPKG cards: {len(mypkg_cards)}")

# Collect all supplier IDs across MYPKG cards
all_suppliers: set[str] = set()
for card in mypkg_cards:
    for sid in (card.get("suppliers") or []):
        all_suppliers.add(sid)

print(f"Distinct supplier IDs across MYPKG cards: {sorted(all_suppliers)}")

# Collect pt_ids for MYPKG
mypkg_pt_ids: set[int] = set()
for card in mypkg_cards:
    pt_id = card.key.id_or_name
    if pt_id:
        mypkg_pt_ids.add(int(pt_id))
print(f"MYPKG pt_ids count: {len(mypkg_pt_ids)}")

# ── Part 2: Sample rate rows — what does supplier_id look like? ─────────────
print("\n=== Part 2: Sample PT-HAULAGE rate rows (first 10 non-price rows) ===")
query2 = ds.query(kind=KIND_MONTHLY_RATE)
query2.add_filter(filter=PropertyFilter("kind", "=", PT_HAULAGE))
query2.add_filter(filter=PropertyFilter("is_price", "=", False))

count = 0
for e in query2.fetch():
    pt_id_raw = e.get("pt_id")
    try:
        pt_id = int(pt_id_raw)
    except (TypeError, ValueError):
        continue
    if pt_id in mypkg_pt_ids:
        print(f"  pt_id={pt_id} supplier_id={e.get('supplier_id')!r} month_year={e.get('month_year')!r}")
        count += 1
        if count >= 10:
            break

if count == 0:
    print("  No MYPKG cost rows found in first batch — sampling all supplier_ids from rate rows:")
    query3 = ds.query(kind=KIND_MONTHLY_RATE)
    query3.add_filter(filter=PropertyFilter("kind", "=", PT_HAULAGE))
    query3.add_filter(filter=PropertyFilter("is_price", "=", False))
    supplier_sample: set[str] = set()
    for e in query3.fetch(limit=5000):
        sid = e.get("supplier_id")
        if sid:
            supplier_sample.add(sid)
    print(f"  Distinct supplier_ids in first 5000 cost rows: {sorted(supplier_sample)}")
