"""
Check which non-MYPKG supplier IDs (2025+) are valid in the companies table.
"""
import os
import sys
from collections import defaultdict
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

from sqlalchemy import text
from core.db import get_engine
from google.cloud import datastore
from google.cloud.datastore.query import PropertyFilter

PROJECT_ID = 'cloud-accele-freight'
KIND_PRICING_HAULAGE = 'PricingHaulage'
KIND_MONTHLY_RATE = 'PTMonthlyRateHaulageTransport'
PT_HAULAGE = 'PT-HAULAGE'
CUTOFF_DATE = date(2025, 1, 1)
EXCLUDE_PORTS = {"MYPKG", "MYPKG_N"}

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
engine = get_engine()

# ── Load company IDs from DB ─────────────────────────────────────────────────
with engine.connect() as conn:
    rows = conn.execute(text("SELECT id FROM companies")).fetchall()
    valid_ids = {r[0] for r in rows}
print(f"Valid company IDs in DB: {len(valid_ids)}")

# ── Get non-MYPKG pt_ids ─────────────────────────────────────────────────────
query = ds.query(kind=KIND_PRICING_HAULAGE)
all_cards = list(query.fetch())
non_mypkg_pt_ids: set[int] = set()
for card in all_cards:
    port = (card.get("port_un_code") or "").strip()
    if port in EXCLUDE_PORTS:
        continue
    pt_id = card.key.id_or_name
    if pt_id:
        non_mypkg_pt_ids.add(int(pt_id))

# ── Fetch rate rows and check supplier IDs ───────────────────────────────────
print(f"\nFetching all PT-HAULAGE entities...")
query2 = ds.query(kind=KIND_MONTHLY_RATE)
query2.add_filter(filter=PropertyFilter("kind", "=", PT_HAULAGE))
all_entities = list(query2.fetch())
print(f"Total fetched: {len(all_entities)}")

valid_count = 0
invalid: dict[str, int] = defaultdict(int)   # supplier_id → row count
valid_sids: dict[str, int] = defaultdict(int)

for e in all_entities:
    pt_id_raw = e.get("pt_id")
    try:
        pt_id = int(pt_id_raw)
    except (TypeError, ValueError):
        continue
    if pt_id not in non_mypkg_pt_ids:
        continue
    effective_from = parse_month_year(e.get("month_year", ""))
    if not effective_from or effective_from < CUTOFF_DATE:
        continue
    is_price = bool(e.get("is_price", False))
    if is_price:
        continue
    sid = e.get("supplier_id") or None
    if sid is None:
        continue
    if sid in valid_ids:
        valid_count += 1
        valid_sids[sid] += 1
    else:
        invalid[sid] += 1

print(f"\n=== Supplier ID validation (2025+ non-MYPKG cost rows) ===")
print(f"  Valid (in companies table): {valid_count} rows across {len(valid_sids)} suppliers")
print(f"  Invalid (not in companies): {sum(invalid.values())} rows across {len(invalid)} suppliers")

if invalid:
    print(f"\n  Invalid supplier IDs:")
    for sid, cnt in sorted(invalid.items(), key=lambda x: -x[1]):
        print(f"    {sid}: {cnt} rows")

if valid_sids:
    print(f"\n  Valid supplier IDs:")
    for sid, cnt in sorted(valid_sids.items(), key=lambda x: -x[1]):
        print(f"    {sid}: {cnt} rows")
