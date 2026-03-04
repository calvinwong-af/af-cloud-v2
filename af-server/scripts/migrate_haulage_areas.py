"""
scripts/migrate_haulage_areas.py

Seed haulage_areas PostgreSQL table from Datastore PricingHaulage + City kinds.

Steps:
  1. Read all active PricingHaulage from Datastore - get unique port+city combos
  2. Fetch each City entity for name, country_code, lat/lng
  3. Insert into haulage_areas (skip duplicates via ON CONFLICT DO NOTHING)

Run from af-server directory with Cloud SQL Auth Proxy running:
    python scripts/migrate_haulage_areas.py

Use --dry-run to preview without writing:
    python scripts/migrate_haulage_areas.py --dry-run
"""

import os
import sys

# Credentials
key_file = os.path.join(os.path.dirname(__file__), '..', 'cloud-accele-freight-key.json')
if os.path.exists(key_file):
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.abspath(key_file)

DRY_RUN = '--dry-run' in sys.argv

from google.cloud import datastore
import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

PROJECT_ID = 'cloud-accele-freight'
ds_client = datastore.Client(project=PROJECT_ID)

# Port codes to ignore
IGNORED_PORTS = {'MYPKG_N'}

# Datastore state code -> PostgreSQL state code mapping
# Datastore uses non-standard codes for some states
STATE_CODE_MAP = {
    'MY-SEL': 'MY-SGR',   # Selangor
    'MY-NE9': 'MY-NSN',   # Negeri Sembilan
    'MY-TER': 'MY-TRG',   # Terengganu
    'MY-PER': 'MY-PRK',   # Perak (alternate code)
    'MY-KLT': 'MY-KTN',   # Kelantan
    'MY-PEJ': 'MY-PJY',   # Putrajaya
    'MY-PKG': 'MY-SGR',   # Port Klang area (within Selangor)
}

# ---------------------------------------------------------------------------
# Step 1: Get unique port+city combos from PricingHaulage
# ---------------------------------------------------------------------------
print("Step 1: Fetching PricingHaulage from Datastore...")

q = ds_client.query(kind='PricingHaulage')
all_haulage = list(q.fetch())
active = [e for e in all_haulage if not e.get('trash', False)]
print(f"  Total active PricingHaulage records: {len(active)}")

combos = {}
for e in active:
    port = (e.get('port_un_code') or '').strip()
    city_code = (e.get('city_code') or '').strip()
    if not port or not city_code:
        continue
    if port in IGNORED_PORTS:
        continue
    key = f"{port}:{city_code}"
    if key not in combos:
        combos[key] = {'port_un_code': port, 'city_code': city_code}

print(f"  Unique port:city combinations (after filtering): {len(combos)}")

# ---------------------------------------------------------------------------
# Step 2: Fetch City entities
# ---------------------------------------------------------------------------
print("\nStep 2: Fetching City entities from Datastore...")

unique_city_codes = list({v['city_code'] for v in combos.values()})
print(f"  Unique city codes to fetch: {len(unique_city_codes)}")

city_keys = [ds_client.key('City', code) for code in unique_city_codes]

def get_multi_chunked(keys, chunk_size=500):
    results = []
    for i in range(0, len(keys), chunk_size):
        chunk = keys[i:i + chunk_size]
        entities = ds_client.get_multi(chunk)
        results.extend([e for e in entities if e is not None])
    return results

city_entities = get_multi_chunked(city_keys)
print(f"  Fetched {len(city_entities)} City entities")

city_map = {}
for entity in city_entities:
    code = entity.key.name
    name = entity.get('name', code)
    country_code = entity.get('code_country', '') or ''

    lat, lng = None, None
    geocode = entity.get('geocode')
    if geocode:
        geometry = geocode.get('geometry') if hasattr(geocode, 'get') else None
        if geometry:
            location = geometry.get('location') if hasattr(geometry, 'get') else None
            if location and hasattr(location, 'get'):
                lat = location.get('lat')
                lng = location.get('lng')

    # Derive Malaysian state code from city_code prefix e.g. MY-SGR-001 -> MY-SGR
    # Apply mapping to normalise Datastore codes to PostgreSQL states table codes
    state_code = None
    if country_code == 'MY' and code.startswith('MY-'):
        parts = code.split('-')
        if len(parts) >= 3:
            raw_state = f"MY-{parts[1]}"
            state_code = STATE_CODE_MAP.get(raw_state, raw_state)

    city_map[code] = {
        'name': name,
        'country_code': country_code,
        'state_code': state_code,
        'lat': float(lat) if lat is not None else None,
        'lng': float(lng) if lng is not None else None,
    }

missing = [c for c in unique_city_codes if c not in city_map]
if missing:
    print(f"  WARNING: {len(missing)} city codes not found in Datastore (will be skipped)")
    for c in missing[:10]:
        print(f"    {c}")

# ---------------------------------------------------------------------------
# Step 3: Build insert rows
# ---------------------------------------------------------------------------
print("\nStep 3: Building haulage_area rows...")

rows = []
for combo in combos.values():
    city_code = combo['city_code']
    port = combo['port_un_code']
    city = city_map.get(city_code)
    if not city:
        continue
    rows.append({
        'area_code': city_code,
        'area_name': city['name'],
        'port_un_code': port,
        'state_code': city['state_code'],
        'lat': city['lat'],
        'lng': city['lng'],
    })

print(f"  Rows to insert: {len(rows)}")

if DRY_RUN:
    print("\n--- DRY RUN - first 20 rows ---")
    for r in rows[:20]:
        print(f"  {r['port_un_code']:8} | {r['area_code']:25} | {r['area_name']:30} | state={r['state_code']} | lat={r['lat']} lng={r['lng']}")
    print(f"\nDry run complete. {len(rows)} rows would be inserted.")
    sys.exit(0)

# ---------------------------------------------------------------------------
# Step 4: Insert into PostgreSQL
# ---------------------------------------------------------------------------
print("\nStep 4: Connecting to PostgreSQL...")

# Parse DATABASE_URL — format: postgresql+psycopg2://user:password@host:port/dbname
db_url = os.environ.get('DATABASE_URL', '')
if not db_url:
    raise RuntimeError('DATABASE_URL not set in .env.local')

# Strip SQLAlchemy driver prefix if present
clean_url = db_url.replace('postgresql+psycopg2://', 'postgresql://')

conn = psycopg2.connect(clean_url)
conn.autocommit = False
cur = conn.cursor()

print(f"  Inserting {len(rows)} rows into haulage_areas...")

inserted = 0
skipped = 0

for r in rows:
    cur.execute("""
        INSERT INTO haulage_areas (area_code, area_name, port_un_code, state_code, lat, lng, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, TRUE)
        ON CONFLICT (area_code, port_un_code) DO NOTHING
    """, (
        r['area_code'],
        r['area_name'],
        r['port_un_code'],
        r['state_code'],
        r['lat'],
        r['lng'],
    ))
    if cur.rowcount == 1:
        inserted += 1
    else:
        skipped += 1

conn.commit()
cur.close()
conn.close()

print(f"\nDone.")
print(f"  Inserted: {inserted}")
print(f"  Skipped (already exists): {skipped}")
