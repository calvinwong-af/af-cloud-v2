"""
scripts/inspect_air_pricing.py

Inspect air freight pricing data in Google Cloud Datastore.

Usage:
    cd af-server
    .venv/Scripts/python scripts/inspect_air_pricing.py
"""
import os
import sys
import json
from collections import defaultdict, Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google.cloud import datastore
from google.cloud.datastore.query import PropertyFilter

PROJECT_ID = 'cloud-accele-freight'

key_file = os.path.join(os.path.dirname(__file__), '..', 'cloud-accele-freight-key.json')
if os.path.exists(key_file):
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.abspath(key_file)

ds = datastore.Client(project=PROJECT_ID)

SAMPLE_SIZE = 5


def _all_keys(entity) -> set:
    return set(entity.keys())


def _print_entity(e, label=""):
    data = dict(e)
    def _clean(v):
        if hasattr(v, 'isoformat'):
            return v.isoformat()
        if hasattr(v, 'flat_path'):  # Datastore Key
            return str(v)
        if isinstance(v, (list, tuple)):
            return [_clean(i) for i in v]
        if isinstance(v, dict):
            return {k: _clean(vv) for k, vv in v.items()}
        try:
            json.dumps(v)
            return v
        except (TypeError, ValueError):
            return str(v)
    clean = {k: _clean(v) for k, v in data.items()}
    print(f"  {label} key.id={e.key.id_or_name}")
    print(f"  {json.dumps(clean, indent=4)}")


# == Part 1: PricingAir rate cards ===========================================
print("\n" + "=" * 60)
print("=== Part 1: PricingAir - Rate Card Entities ===")
print("=" * 60)

air_card_query = ds.query(kind="PricingAir")
air_cards = list(air_card_query.fetch())
print(f"\nTotal PricingAir entities: {len(air_cards)}")

if air_cards:
    all_card_fields = set()
    trashed = 0
    pt_id_samples = []
    field_value_samples = defaultdict(set)

    for e in air_cards:
        if e.get("trash", False):
            trashed += 1
        all_card_fields |= _all_keys(e)
        pt_id = e.get("pt_id", "")
        if pt_id and len(pt_id_samples) < 20:
            pt_id_samples.append(pt_id)
        for field in ["dg_class_code", "cargo_type_code", "airline_code"]:
            v = e.get(field)
            if v is not None:
                field_value_samples[field].add(str(v))

    print(f"Trashed: {trashed} | Active: {len(air_cards) - trashed}")
    print(f"\nAll fields on PricingAir:")
    for f in sorted(all_card_fields):
        print(f"  - {f}")
    print(f"\nDistinct values for key dimension fields:")
    for field, values in sorted(field_value_samples.items()):
        print(f"  {field}: {sorted(values)}")
    print(f"\nFull entity dumps (first {SAMPLE_SIZE} non-trashed):")
    shown = 0
    for e in air_cards:
        if e.get("trash", False):
            continue
        _print_entity(e, label=f"[Card {shown+1}]")
        shown += 1
        if shown >= SAMPLE_SIZE:
            break


# == Part 2: PT-AIR rate rows (full scan) ====================================
print("\n" + "=" * 60)
print("=== Part 2: PT-AIR Rate Rows (full scan) ===")
print("=" * 60)

air_rate_query = ds.query(kind="PTMonthlyRateOceanAir")
air_rate_query.add_filter(filter=PropertyFilter("kind", "=", "PT-AIR"))
air_rate_entities = list(air_rate_query.fetch())
print(f"\nTotal PT-AIR rate rows: {len(air_rate_entities)}")

if air_rate_entities:
    ctr_rows = [e for e in air_rate_entities if e.get("uom") == "CTR"]
    cw_rows  = [e for e in air_rate_entities if e.get("uom") == "CW"]

    # == CTR UOM investigation ================================================
    print(f"\n--- CTR UOM Investigation ---")
    print(f"CTR rows: {len(ctr_rows)}")
    print(f"CW rows:  {len(cw_rows)}")

    if ctr_rows:
        ctr_pt_ids = set(e.get("pt_id", "") for e in ctr_rows)
        cw_pt_ids  = set(e.get("pt_id", "") for e in cw_rows)
        overlap  = ctr_pt_ids & cw_pt_ids
        ctr_only = ctr_pt_ids - cw_pt_ids

        print(f"\nDistinct pt_ids with CTR rows ({len(ctr_pt_ids)}):")
        for pt in sorted(ctr_pt_ids):
            print(f"  {pt}")

        print(f"\nCTR pt_ids that also have CW rows: {len(overlap)}")
        print(f"CTR pt_ids with NO CW rows (CTR-only cards): {len(ctr_only)}")
        if ctr_only:
            print(f"  CTR-only pt_ids: {sorted(ctr_only)}")

        ctr_years = Counter()
        for e in ctr_rows:
            my = e.get("month_year", "")
            if "-" in my:
                ctr_years[my.split("-")[1]] += 1
        print(f"\nCTR rows by year: {dict(sorted(ctr_years.items()))}")

        print(f"\nFull entity dumps (first 3 CTR rows):")
        shown = 0
        for e in ctr_rows:
            _print_entity(e, label=f"[CTR row {shown+1}]")
            shown += 1
            if shown >= 3:
                break

    # == CW entity dumps ======================================================
    print(f"\n--- CW Row Entity Dumps ---")
    print(f"\nFull entity dumps (first {SAMPLE_SIZE} CW price rows):")
    shown = 0
    for e in cw_rows:
        if not e.get("is_price", False):
            continue
        _print_entity(e, label=f"[Price row {shown+1}]")
        shown += 1
        if shown >= SAMPLE_SIZE:
            break

    print(f"\nFull entity dumps (first {SAMPLE_SIZE} CW cost rows):")
    shown = 0
    for e in cw_rows:
        if e.get("is_price", False):
            continue
        _print_entity(e, label=f"[Cost row {shown+1}]")
        shown += 1
        if shown >= SAMPLE_SIZE:
            break

print("\n=== Inspection complete ===")
