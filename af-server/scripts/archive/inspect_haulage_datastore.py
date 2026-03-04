"""
scripts/inspect_haulage_datastore.py

Inspect PricingHaulage entities in Datastore.
Run from af-server directory:
    python scripts/inspect_haulage_datastore.py

Requires Cloud SQL Auth Proxy NOT needed — this only hits Datastore.
Requires: GOOGLE_APPLICATION_CREDENTIALS set, or cloud-accele-freight-key.json present.
"""

import os
import sys
import json

# Set credentials if key file exists
key_file = os.path.join(os.path.dirname(__file__), '..', 'cloud-accele-freight-key.json')
if os.path.exists(key_file):
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.abspath(key_file)

from google.cloud import datastore

PROJECT_ID = 'cloud-accele-freight'
KIND = 'PricingHaulage'

client = datastore.Client(project=PROJECT_ID)

print(f"Querying Datastore Kind: {KIND}")
print("=" * 60)

query = client.query(kind=KIND)
results = list(query.fetch(limit=5))

if not results:
    print(f"No entities found for Kind '{KIND}'")
    print("\nTrying alternative Kind names...")
    for alt_kind in ['HaulageArea', 'HaulageZone', 'Haulage', 'PricingArea', 'DeliveryArea']:
        q = client.query(kind=alt_kind)
        r = list(q.fetch(limit=1))
        if r:
            print(f"  Found entities in Kind: '{alt_kind}'")
    sys.exit(0)

print(f"Found entities. Showing first {len(results)} samples:\n")

for i, entity in enumerate(results):
    print(f"--- Entity {i+1} ---")
    print(f"  Key: {entity.key}")
    print(f"  Fields:")
    for k, v in entity.items():
        print(f"    {k}: {repr(v)}")
    print()

# Also get total count
count_query = client.query(kind=KIND)
all_results = list(count_query.fetch())
print(f"Total {KIND} entities: {len(all_results)}")
