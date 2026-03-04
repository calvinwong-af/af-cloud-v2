"""
scripts/geocode_ports.py

Backfills lat/lng coordinates for all ports in the PostgreSQL `ports` table
by calling the Google Geocoding API.

- Skips ports that already have coordinates
- AIR ports: geocoded by full airport name
- SEA ports: geocoded by "port name, country"
- Logs each port result (success or failure)
- Safe to re-run — only processes NULL lat/lng records

# Ensure Cloud SQL Auth Proxy is running first
# Then run:
python -m scripts.geocode_ports
"""

import os
import sys
import time

import requests

sys.path.insert(0, ".")

from dotenv import load_dotenv
load_dotenv(".env.local")

from core.db import get_engine
from sqlalchemy import text


GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

SELECT_SQL = text("""
    SELECT un_code, name, country, port_type
    FROM ports
    WHERE lat IS NULL OR lng IS NULL
    ORDER BY port_type, un_code
""")

UPDATE_SQL = text("""
    UPDATE ports SET lat = :lat, lng = :lng WHERE un_code = :un_code
""")


def build_query(port: dict) -> str:
    if port["port_type"] == "AIR":
        return port["name"]
    return f"{port['name']}, {port['country']}"


def geocode(address: str, api_key: str) -> tuple[float, float] | None:
    try:
        resp = requests.get(GEOCODE_URL, params={"address": address, "key": api_key}, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  ERROR: network error — {e}")
        return None

    if data.get("status") != "OK" or not data.get("results"):
        print(f"  SKIP: API returned status={data.get('status')}")
        return None

    loc = data["results"][0]["geometry"]["location"]
    return loc["lat"], loc["lng"]


def main():
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_MAPS_API_KEY not set in environment. Add it to .env.local.")

    engine = get_engine()
    total = 0
    succeeded = 0
    failed = 0

    with engine.connect() as conn:
        rows = conn.execute(SELECT_SQL).mappings().all()
        total = len(rows)
        print(f"Found {total} ports missing coordinates.\n")

        for row in rows:
            port = dict(row)
            query = build_query(port)
            print(f"[{port['port_type']}] {port['un_code']} — geocoding: \"{query}\"")

            result = geocode(query, api_key)
            if result is None:
                failed += 1
                continue

            lat, lng = result
            conn.execute(UPDATE_SQL, {"lat": lat, "lng": lng, "un_code": port["un_code"]})
            conn.commit()
            succeeded += 1
            print(f"  OK: lat={lat}, lng={lng}")

            time.sleep(0.5)

    print(f"\nDone. Total: {total}, Succeeded: {succeeded}, Failed: {failed}")


if __name__ == "__main__":
    main()
