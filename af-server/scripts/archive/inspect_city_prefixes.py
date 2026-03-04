"""
scripts/inspect_city_prefixes.py

Extract all unique state prefixes from PricingHaulage city_codes in Datastore.
Compares against PostgreSQL states table codes.
Writes output to scripts/inspect_city_prefixes_output.txt

Run from af-server directory:
    python scripts/inspect_city_prefixes.py
"""

import os

key_file = os.path.join(os.path.dirname(__file__), '..', 'cloud-accele-freight-key.json')
if os.path.exists(key_file):
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.abspath(key_file)

from google.cloud import datastore

PROJECT_ID = 'cloud-accele-freight'
client = datastore.Client(project=PROJECT_ID)

PG_STATES = {
    'MY-JHR', 'MY-KDH', 'MY-KTN', 'MY-MLK', 'MY-NSN',
    'MY-PHG', 'MY-PNG', 'MY-PRK', 'MY-PLS', 'MY-SGR',
    'MY-TRG', 'MY-SBH', 'MY-SWK', 'MY-KUL', 'MY-LBN', 'MY-PJY',
}

output_file = os.path.join(os.path.dirname(__file__), 'inspect_city_prefixes_output.txt')

q = client.query(kind='PricingHaulage')
all_haulage = list(q.fetch())
active = [e for e in all_haulage if not e.get('trash', False)]

# Extract unique state prefixes from MY- city codes
prefix_cities = {}  # prefix -> list of example city codes
for e in active:
    city_code = (e.get('city_code') or '').strip()
    if not city_code.startswith('MY-'):
        continue
    parts = city_code.split('-')
    if len(parts) >= 3:
        prefix = f"MY-{parts[1]}"
        if prefix not in prefix_cities:
            prefix_cities[prefix] = []
        if city_code not in prefix_cities[prefix]:
            prefix_cities[prefix].append(city_code)

lines = []
lines.append("=== Unique MY- state prefixes in PricingHaulage city_codes ===")
lines.append("")
lines.append(f"{'Prefix':<15} {'In PG states?':<20} {'Example city codes'}")
lines.append("-" * 80)

mismatches = []
for prefix in sorted(prefix_cities.keys()):
    in_pg = 'OK' if prefix in PG_STATES else 'MISMATCH'
    examples = ', '.join(sorted(prefix_cities[prefix])[:3])
    lines.append(f"{prefix:<15} {in_pg:<20} {examples}")
    if prefix not in PG_STATES:
        mismatches.append(prefix)

lines.append("")
lines.append(f"Total prefixes: {len(prefix_cities)} | Mismatches: {len(mismatches)}")
if mismatches:
    lines.append("")
    lines.append("Prefixes needing mapping:")
    for p in mismatches:
        lines.append(f"  {p}")

with open(output_file, 'w') as f:
    f.write('\n'.join(lines))

print(f"Done. Output written to: {output_file}")
print(f"Total prefixes: {len(prefix_cities)} | Mismatches: {len(mismatches)}")
