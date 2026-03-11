"""
Post-migration verification for air freight pricing.
Run after migrate_air_pricing.py completes (no --dry-run).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

from sqlalchemy import text
from core.db import get_engine

engine = get_engine()

with engine.connect() as conn:

    # ── Rate cards ────────────────────────────────────────────────────────────
    print("=== air_freight_rate_cards ===")
    total_cards = conn.execute(text("SELECT COUNT(*) FROM air_freight_rate_cards")).scalar()
    print(f"  Total cards: {total_cards}")

    print("\n  By origin port (top 10):")
    rows = conn.execute(text("""
        SELECT origin_port_code, COUNT(*) AS cards
        FROM air_freight_rate_cards
        GROUP BY origin_port_code
        ORDER BY cards DESC
        LIMIT 10
    """)).fetchall()
    for r in rows:
        print(f"    {r[0]}: {r[1]}")

    print("\n  By dg_class_code:")
    rows = conn.execute(text("""
        SELECT dg_class_code, COUNT(*) AS cards
        FROM air_freight_rate_cards
        GROUP BY dg_class_code
        ORDER BY cards DESC
    """)).fetchall()
    for r in rows:
        print(f"    {r[0]}: {r[1]}")

    print("\n  By airline_code (top 10):")
    rows = conn.execute(text("""
        SELECT airline_code, COUNT(*) AS cards
        FROM air_freight_rate_cards
        GROUP BY airline_code
        ORDER BY cards DESC
        LIMIT 10
    """)).fetchall()
    for r in rows:
        print(f"    {r[0]}: {r[1]}")

    # ── Rate rows ─────────────────────────────────────────────────────────────
    print("\n=== air_freight_rates ===")
    total_rates = conn.execute(text("SELECT COUNT(*) FROM air_freight_rates")).scalar()
    print(f"  Total rate rows: {total_rates}")

    print("\n  List price vs supplier cost:")
    rows = conn.execute(text("""
        SELECT
            CASE WHEN supplier_id IS NULL THEN 'list_price' ELSE 'supplier_cost' END AS row_type,
            COUNT(*) AS cnt
        FROM air_freight_rates
        GROUP BY row_type
    """)).fetchall()
    for r in rows:
        print(f"    {r[0]}: {r[1]}")

    print("\n  By supplier_id (cost rows, top 10):")
    rows = conn.execute(text("""
        SELECT supplier_id, COUNT(*) AS cnt
        FROM air_freight_rates
        WHERE supplier_id IS NOT NULL
        GROUP BY supplier_id
        ORDER BY cnt DESC
        LIMIT 10
    """)).fetchall()
    for r in rows:
        print(f"    {r[0]}: {r[1]}")

    print("\n  Effective date range:")
    row = conn.execute(text("""
        SELECT MIN(effective_from), MAX(effective_from)
        FROM air_freight_rates
    """)).fetchone()
    print(f"    earliest effective_from: {row[0]}")
    print(f"    latest effective_from:   {row[1]}")

    open_ended = conn.execute(text(
        "SELECT COUNT(*) FROM air_freight_rates WHERE effective_to IS NULL"
    )).scalar()
    print(f"\n  Open-ended rows (effective_to IS NULL): {open_ended}")

    print("\n  Rows with surcharges (fsc/msc/ssc):")
    rows = conn.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE surcharges IS NOT NULL) AS with_surcharges,
            COUNT(*) FILTER (WHERE surcharges IS NULL)     AS without_surcharges
        FROM air_freight_rates
    """)).fetchone()
    print(f"    with surcharges:    {rows[0]}")
    print(f"    without surcharges: {rows[1]}")

    print("\n  Sample rate row (latest list price for KUL origin):")
    sample = conn.execute(text("""
        SELECT
            arc.origin_port_code,
            arc.destination_port_code,
            arc.dg_class_code,
            arc.airline_code,
            ar.effective_from,
            ar.effective_to,
            ar.currency,
            ar.l45_list_price,
            ar.p100_list_price,
            ar.min_list_price,
            ar.surcharges
        FROM air_freight_rates ar
        JOIN air_freight_rate_cards arc ON ar.rate_card_id = arc.id
        WHERE arc.origin_port_code = 'KUL'
          AND ar.supplier_id IS NULL
        ORDER BY ar.effective_from DESC
        LIMIT 1
    """)).fetchone()
    if sample:
        print(f"    route:         {sample[0]} → {sample[1]}")
        print(f"    dg_class:      {sample[2]}")
        print(f"    airline:       {sample[3]}")
        print(f"    effective:     {sample[4]} → {sample[5]}")
        print(f"    currency:      {sample[6]}")
        print(f"    l45:           {sample[7]}")
        print(f"    p100:          {sample[8]}")
        print(f"    min:           {sample[9]}")
        print(f"    surcharges:    {sample[10]}")

    # ── FK integrity ──────────────────────────────────────────────────────────
    print("\n=== FK integrity ===")
    orphan_cards = conn.execute(text("""
        SELECT COUNT(*) FROM air_freight_rates ar
        LEFT JOIN air_freight_rate_cards arc ON ar.rate_card_id = arc.id
        WHERE arc.id IS NULL
    """)).scalar()
    print(f"  Orphan rate rows (no matching card): {orphan_cards}")

    orphan_suppliers = conn.execute(text("""
        SELECT COUNT(*) FROM air_freight_rates ar
        LEFT JOIN companies c ON ar.supplier_id = c.id
        WHERE ar.supplier_id IS NOT NULL AND c.id IS NULL
    """)).scalar()
    print(f"  Orphan supplier_ids (not in companies): {orphan_suppliers}")

print("\nVerification complete.")
