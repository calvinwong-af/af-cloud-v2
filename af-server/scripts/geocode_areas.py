"""
scripts/geocode_areas.py — Populate lat/lng for areas with NULL coordinates.

Usage:
    python scripts/geocode_areas.py [--dry-run] [--limit N]

Requires:
    - GOOGLE_MAPS_API_KEY in environment or .env.local
    - DB connection via AUTH_PROXY (localhost:5432)
    - Migration 035 applied first
"""

import argparse
import os
import time
import httpx
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(".env.local")

DB_URL = os.environ["DATABASE_URL"]
GOOGLE_API_KEY = os.environ["GOOGLE_MAPS_API_KEY"]
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


def geocode(area_name: str, state_code: str) -> tuple[float, float] | None:
    """Geocode area_name + state context. Returns (lat, lng) or None."""
    # Use state_code to provide country context (e.g. MY-SGR → Malaysia)
    country_code = state_code.split("-")[0]
    query = f"{area_name}, {country_code}"
    try:
        resp = httpx.get(GEOCODE_URL, params={"address": query, "key": GOOGLE_API_KEY}, timeout=10)
        data = resp.json()
        if data.get("status") == "OK" and data.get("results"):
            loc = data["results"][0]["geometry"]["location"]
            return float(loc["lat"]), float(loc["lng"])
    except Exception as e:
        print(f"  [ERROR] {area_name}: {e}")
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print results without writing to DB")
    parser.add_argument("--limit", type=int, default=None, help="Max areas to process")
    args = parser.parse_args()

    engine = create_engine(DB_URL)
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT area_id, area_name, state_code
            FROM areas
            WHERE lat IS NULL OR lng IS NULL
            ORDER BY area_id
        """)).fetchall()

    if args.limit:
        rows = rows[:args.limit]

    print(f"Areas to geocode: {len(rows)}")
    results = []

    for area_id, area_name, state_code in rows:
        coords = geocode(area_name, state_code)
        if coords:
            lat, lng = coords
            print(f"  OK [{area_id}] {area_name} ({state_code}) -> {lat}, {lng}")
            results.append((area_id, lat, lng))
        else:
            print(f"  MISS [{area_id}] {area_name} ({state_code}) -> no result")
        time.sleep(0.1)  # Respect API rate limit

    print(f"\nGeocoded: {len(results)}/{len(rows)}")

    if args.dry_run:
        print("Dry run — no DB writes.")
        return

    if not results:
        print("Nothing to write.")
        return

    with engine.connect() as conn:
        for area_id, lat, lng in results:
            conn.execute(text("""
                UPDATE areas SET lat = :lat, lng = :lng WHERE area_id = :id
            """), {"lat": lat, "lng": lng, "id": area_id})
        conn.commit()

    print(f"Updated {len(results)} area rows.")


if __name__ == "__main__":
    main()
