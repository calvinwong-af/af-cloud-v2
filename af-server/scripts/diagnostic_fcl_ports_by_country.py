"""
scripts/diagnostic_fcl_ports_by_country.py

Compares FCL rate card origin ports between Datastore and PostgreSQL
for CN and MY origins. Shows active/trashed breakdown in Datastore
and card/rate counts in PostgreSQL.

Usage:
    cd af-server
    .venv/Scripts/python scripts/diagnostic_fcl_ports_by_country.py
"""

import sys
import os
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

from google.cloud import datastore
from sqlalchemy import text
from core.db import get_engine

TARGET_PREFIXES = ("CN", "MY")


def fetch_datastore(ds_client):
    print("Fetching PricingFCL entities from Datastore...")
    entities = list(ds_client.query(kind="PricingFCL").fetch())
    print(f"Total PricingFCL entities: {len(entities)}\n")

    active: dict[str, int] = defaultdict(int)
    trashed: dict[str, int] = defaultdict(int)

    for e in entities:
        origin = e.get("port_origin_un_code", "UNKNOWN")
        if not any(origin.startswith(p) for p in TARGET_PREFIXES):
            continue
        if e.get("trash", False):
            trashed[origin] += 1
        else:
            active[origin] += 1

    return active, trashed


def fetch_postgres(engine):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT
                rc.origin_port_code,
                COUNT(DISTINCT rc.id)   AS total_cards,
                COUNT(r.id)             AS total_rates,
                MIN(r.effective_from)   AS earliest_rate,
                MAX(r.effective_from)   AS latest_rate
            FROM fcl_rate_cards rc
            LEFT JOIN fcl_rates r ON r.rate_card_id = rc.id
            WHERE rc.origin_port_code LIKE 'CN%'
               OR rc.origin_port_code LIKE 'MY%'
            GROUP BY rc.origin_port_code
            ORDER BY rc.origin_port_code
        """)).fetchall()
    return {r[0]: {"cards": r[1], "rates": r[2], "earliest": r[3], "latest": r[4]} for r in rows}


def print_report(active, trashed, pg_data):
    all_ports = sorted(set(list(active.keys()) + list(trashed.keys()) + list(pg_data.keys())))

    for prefix in TARGET_PREFIXES:
        ports = [p for p in all_ports if p.startswith(prefix)]
        if not ports:
            continue

        print(f"{'=' * 72}")
        print(f"  {prefix} — Origin Ports")
        print(f"{'=' * 72}")
        print(f"{'Port':<12} {'DS Active':>10} {'DS Trash':>9} {'PG Cards':>9} {'PG Rates':>9} {'Earliest':>12} {'Latest':>12} {'Status'}")
        print(f"{'-' * 80}")

        for port in ports:
            ds_a = active.get(port, 0)
            ds_t = trashed.get(port, 0)
            pg = pg_data.get(port, {})
            pg_c = pg.get("cards", 0)
            pg_r = pg.get("rates", 0)
            earliest = str(pg.get("earliest", ""))[:10] if pg.get("earliest") else "—"
            latest = str(pg.get("latest", ""))[:10] if pg.get("latest") else "—"

            if ds_a > 0 and pg_c == 0:
                status = "❌ MISSING FROM PG"
            elif ds_a > 0 and pg_c > 0 and pg_r == 0:
                status = "⚠️  NO RATES"
            elif ds_a == 0 and pg_c > 0:
                status = "⚠️  IN PG ONLY"
            elif ds_a > 0 and pg_c > 0:
                status = "✅ OK"
            else:
                status = "—"

            print(f"{port:<12} {ds_a:>10} {ds_t:>9} {pg_c:>9} {pg_r:>9} {earliest:>12} {latest:>12}  {status}")

        total_ds_a = sum(active.get(p, 0) for p in ports)
        total_ds_t = sum(trashed.get(p, 0) for p in ports)
        total_pg_c = sum(pg_data.get(p, {}).get("cards", 0) for p in ports)
        total_pg_r = sum(pg_data.get(p, {}).get("rates", 0) for p in ports)
        print(f"{'-' * 80}")
        print(f"{'TOTAL':<12} {total_ds_a:>10} {total_ds_t:>9} {total_pg_c:>9} {total_pg_r:>9}")
        print()


def main():
    ds_client = datastore.Client()
    engine = get_engine()

    active, trashed = fetch_datastore(ds_client)
    pg_data = fetch_postgres(engine)
    print_report(active, trashed, pg_data)


if __name__ == "__main__":
    main()
