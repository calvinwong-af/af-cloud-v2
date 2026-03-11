"""
Check FAF values on PT-HAULAGE rate entities.
Since port_un_code is NOT stored on rate entities, we resolve port via pt_id
membership in PricingHaulage cards (same approach as migrate_haulage_pricing.py).

Reports:
  - FAF values grouped by port_un_code (via card lookup)
  - Whether any non-Malaysian ports have non-zero FAF values
  - Sample entities with non-zero FAF for non-MY ports
"""
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google.cloud import datastore
from google.cloud.datastore.query import PropertyFilter

PROJECT_ID = 'cloud-accele-freight'

key_file = os.path.join(os.path.dirname(__file__), '..', 'cloud-accele-freight-key.json')
if os.path.exists(key_file):
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.abspath(key_file)

ds = datastore.Client(project=PROJECT_ID)

MY_PORT_PREFIXES = {"MY", "MYPKG", "MYPKG_N"}

def _safe_float(val):
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None

# Step 1: Build pt_id → port_un_code map from PricingHaulage cards
print("=== Step 1: Loading PricingHaulage cards ===")
card_query = ds.query(kind="PricingHaulage")
cards = list(card_query.fetch())
print(f"Total PricingHaulage cards: {len(cards)}")

pt_id_to_port: dict[int, str] = {}
for e in cards:
    pt_id = e.key.id_or_name
    port = (e.get("port_un_code") or "").strip()
    if pt_id and port:
        try:
            pt_id_to_port[int(pt_id)] = port
        except (ValueError, TypeError):
            pass

print(f"pt_id → port map built: {len(pt_id_to_port)} entries")

# Step 2: Scan PT-HAULAGE rate entities for non-zero FAF
print("\n=== Step 2: Scanning PT-HAULAGE rate entities for FAF ===")
rate_query = ds.query(kind="PTMonthlyRateHaulageTransport")
rate_query.add_filter(filter=PropertyFilter("kind", "=", "PT-HAULAGE"))
entities = list(rate_query.fetch())
print(f"Total PT-HAULAGE entities: {len(entities)}")

# faf_by_port: {port_un_code: set of non-zero (faf_percent, faf_value) tuples}
faf_by_port: dict[str, set] = defaultdict(set)
unresolved_with_faf = 0
non_my_samples = []

for e in entities:
    faf_data = e.get("faf") or {}
    if not isinstance(faf_data, dict):
        continue

    faf_percent = _safe_float(faf_data.get("faf_percent") or faf_data.get("percent"))
    faf_value   = _safe_float(faf_data.get("faf_value") or faf_data.get("value"))

    # Skip if both are zero or None
    has_faf = (faf_percent is not None and faf_percent != 0) or \
              (faf_value is not None and faf_value != 0)
    if not has_faf:
        continue

    pt_id_raw = e.get("pt_id")
    try:
        pt_id = int(pt_id_raw)
    except (TypeError, ValueError):
        unresolved_with_faf += 1
        continue

    port = pt_id_to_port.get(pt_id, "UNKNOWN")
    faf_by_port[port].add((faf_percent, faf_value))

    # Collect samples for non-Malaysian ports
    is_my = port.startswith("MY") or port in MY_PORT_PREFIXES
    if not is_my and len(non_my_samples) < 10:
        non_my_samples.append({
            "pt_id": pt_id,
            "port": port,
            "faf_percent": faf_percent,
            "faf_value": faf_value,
            "month_year": e.get("month_year"),
            "supplier_id": e.get("supplier_id"),
        })

# Step 3: Report
print("\n=== FAF values by port ===")
my_ports = []
non_my_ports = []

for port in sorted(faf_by_port.keys()):
    is_my = port.startswith("MY") or port in MY_PORT_PREFIXES
    vals = sorted(faf_by_port[port], key=lambda t: (t[0] or 0, t[1] or 0))
    entry = (port, vals)
    if is_my:
        my_ports.append(entry)
    else:
        non_my_ports.append(entry)

print(f"\nMalaysian ports with FAF ({len(my_ports)}):")
for port, vals in my_ports:
    print(f"  {port}: {vals}")

print(f"\nNon-Malaysian ports with FAF ({len(non_my_ports)}):")
if non_my_ports:
    for port, vals in non_my_ports:
        print(f"  {port}: {vals}")
else:
    print("  None — FAF is MY-only")

if non_my_samples:
    print(f"\nSample non-MY FAF entities:")
    for s in non_my_samples:
        print(f"  {s}")

if unresolved_with_faf:
    print(f"\nEntities with FAF but unresolvable pt_id: {unresolved_with_faf}")

print("\n=== Done ===")
