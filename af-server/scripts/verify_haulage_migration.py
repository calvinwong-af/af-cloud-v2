"""
Post-migration verification for haulage pricing.
Run after migrate_haulage_pricing.py completes (no --dry-run).
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

    # ── Rate cards ───────────────────────────────────────────────────────────
    print("=== haulage_rate_cards ===")
    total_cards = conn.execute(text("SELECT COUNT(*) FROM haulage_rate_cards")).scalar()
    print(f"  Total cards: {total_cards}")

    print("\n  By port (top 10):")
    rows = conn.execute(text("""
        SELECT port_un_code, COUNT(*) AS cards
        FROM haulage_rate_cards
        GROUP BY port_un_code
        ORDER BY cards DESC
        LIMIT 10
    """)).fetchall()
    for r in rows:
        print(f"    {r[0]}: {r[1]}")

    print("\n  By container_size:")
    rows = conn.execute(text("""
        SELECT container_size, COUNT(*) AS cards
        FROM haulage_rate_cards
        GROUP BY container_size
        ORDER BY cards DESC
    """)).fetchall()
    for r in rows:
        print(f"    {r[0]}: {r[1]}")

    side_loader = conn.execute(text(
        "SELECT COUNT(*) FROM haulage_rate_cards WHERE side_loader_available = TRUE"
    )).scalar()
    print(f"\n  Cards with side_loader_available=TRUE: {side_loader}")

    northport = conn.execute(text(
        "SELECT COUNT(*) FROM haulage_rate_cards WHERE terminal_id = 'MYPKG_N'"
    )).scalar()
    print(f"  Northport (MYPKG_N) cards: {northport}")

    # ── Rate rows ─────────────────────────────────────────────────────────────
    print("\n=== haulage_rates ===")
    total_rates = conn.execute(text("SELECT COUNT(*) FROM haulage_rates")).scalar()
    print(f"  Total rate rows: {total_rates}")

    print("\n  List price vs supplier cost:")
    rows = conn.execute(text("""
        SELECT
            CASE WHEN supplier_id IS NULL THEN 'list_price' ELSE 'supplier_cost' END AS row_type,
            COUNT(*) AS cnt
        FROM haulage_rates
        GROUP BY row_type
    """)).fetchall()
    for r in rows:
        print(f"    {r[0]}: {r[1]}")

    print("\n  By supplier_id (cost rows):")
    rows = conn.execute(text("""
        SELECT supplier_id, COUNT(*) AS cnt
        FROM haulage_rates
        WHERE supplier_id IS NOT NULL
        GROUP BY supplier_id
        ORDER BY cnt DESC
    """)).fetchall()
    for r in rows:
        print(f"    {r[0]}: {r[1]}")

    print("\n  Effective date range:")
    rows = conn.execute(text("""
        SELECT MIN(effective_from), MAX(effective_from)
        FROM haulage_rates
    """)).fetchone()
    print(f"    earliest effective_from: {rows[0]}")
    print(f"    latest effective_from:   {rows[1]}")

    open_ended = conn.execute(text(
        "SELECT COUNT(*) FROM haulage_rates WHERE effective_to IS NULL"
    )).scalar()
    print(f"\n  Open-ended rows (effective_to IS NULL): {open_ended}")

    print("\n  Rows with side_loader_surcharge > 0:")
    sl_rows = conn.execute(text(
        "SELECT COUNT(*) FROM haulage_rates WHERE side_loader_surcharge > 0"
    )).scalar()
    print(f"    {sl_rows}")

    print("\n  Rows with toll fee in surcharges:")
    toll_rows = conn.execute(text(
        "SELECT COUNT(*) FROM haulage_rates WHERE surcharges IS NOT NULL"
    )).scalar()
    print(f"    {toll_rows}")

    # ── FK integrity check ────────────────────────────────────────────────────
    print("\n=== FK integrity ===")
    orphan_cards = conn.execute(text("""
        SELECT COUNT(*) FROM haulage_rates hr
        LEFT JOIN haulage_rate_cards hrc ON hr.rate_card_id = hrc.id
        WHERE hrc.id IS NULL
    """)).scalar()
    print(f"  Orphan rate rows (no matching card): {orphan_cards}")

    orphan_suppliers = conn.execute(text("""
        SELECT COUNT(*) FROM haulage_rates hr
        LEFT JOIN companies c ON hr.supplier_id = c.id
        WHERE hr.supplier_id IS NOT NULL AND c.id IS NULL
    """)).scalar()
    print(f"  Orphan supplier_ids (not in companies): {orphan_suppliers}")

print("\nVerification complete.")
