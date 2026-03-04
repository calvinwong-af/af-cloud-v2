"""
scripts/inspect_city_datastore.py

Inspect City entities in Datastore and show unique haulage area mapping.
Run from af-server directory:
    python scripts/inspect_city_datastore.py
"""

import os

key_file = os.path.join(os.path.dirname(__file__), '..', 'cloud-accele-freight-key.json')
if os.path.exists(key_file):
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.abspath(key_file)

from google.cloud import datastore

PROJECT_ID = 'cloud-accele-freight'
client = datastore.Client(project=PROJECT_ID)

# --- Sample City entities ---
print("=== City Kind — 5 samples ===")
q = client.query(kind='City')
for entity in list(q.fetch(limit=5)):
    print(f"  Key: {entity.key.name}")
    for k, v in entity.items():
        print(f"    {k}: {repr(v)}")
    print()

# --- Unique city_codes from PricingHaulage ---
print("=== Unique city_codes in PricingHaulage ===")
q = client.query(kind='PricingHaulage')
q.add_filter('trash', '=', False)
all_haulage = list(q.fetch())
print(f"Total active PricingHaulage records: {len(all_haulage)}\n")

# Show unique port + city combinations
combos = {}
for e in all_haulage:
    port = e.get('port_un_code', '')
    city = e.get('city_code', '')
    key = f"{port}:{city}"
    if key not in combos:
        combos[key] = {'port_un_code': port, 'city_code': city, 'count': 0}
    combos[key]['count'] += 1

print(f"Unique port:city combinations: {len(combos)}")
print()
for k, v in sorted(combos.items()):
    print(f"  {v['port_un_code']:8} | {v['city_code']:20} | {v['count']} records")
