"""
scripts/inspect_states_datastore.py

List all State entities in Datastore and compare against PostgreSQL states table.
Writes output to scripts/inspect_states_output.txt

Run from af-server directory:
    python scripts/inspect_states_datastore.py
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

output_file = os.path.join(os.path.dirname(__file__), 'inspect_states_output.txt')

lines = []
lines.append("=== All State entities in Datastore ===")
lines.append("")

q = client.query(kind='State')
states = list(q.fetch())
lines.append(f"Total State entities: {len(states)}")
lines.append("")
lines.append(f"{'Datastore Key':<20} {'Name':<30} {'Match?'}")
lines.append("-" * 65)

mismatches = []
for entity in sorted(states, key=lambda e: e.key.name or ''):
    code = entity.key.name or str(entity.key.id)
    name = entity.get('name', '')
    if code in PG_STATES:
        match = 'OK'
    else:
        match = 'MISMATCH'
        mismatches.append({'code': code, 'name': name})
    lines.append(f"{code:<20} {name:<30} {match}")

lines.append("")
lines.append(f"Total: {len(states)} | Mismatches: {len(mismatches)}")

if mismatches:
    lines.append("")
    lines.append("Mismatched codes (need mapping):")
    for m in mismatches:
        lines.append(f"  {m['code']:<20} {m['name']}")

with open(output_file, 'w') as f:
    f.write('\n'.join(lines))

print(f"Done. Output written to: {output_file}")
print(f"Total states: {len(states)} | Mismatches: {len(mismatches)}")
