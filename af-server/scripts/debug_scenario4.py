"""
debug_scenario4.py — Diagnose why Scenario 4 cards are not appearing in alerts_only.
Run from af-server directory with venv active:
  python scripts/debug_scenario4.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://localhost/accelefreight")
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("=== Cards matching Scenario 4 (no effective_to filter) ===")
    rows = conn.execute(text("""
        SELECT rc.id, rc.rate_card_key
        FROM lcl_rate_cards rc
        JOIN ports AS op ON op.un_code = rc.origin_port_code
        WHERE rc.is_active = true
        AND op.country_code = 'MY'
        AND EXISTS (
            SELECT 1 FROM lcl_rates r
            WHERE r.rate_card_id = rc.id
              AND r.supplier_id IS NULL
              AND r.rate_status = 'PUBLISHED'
              AND r.effective_from <= CURRENT_DATE
              AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
              AND r.list_price IS NOT NULL
        )
        AND NOT EXISTS (
            SELECT 1 FROM lcl_rates r
            WHERE r.rate_card_id = rc.id
              AND r.supplier_id IS NOT NULL
              AND r.rate_status = 'PUBLISHED'
              AND r.effective_from <= CURRENT_DATE
              AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
              AND r.cost IS NOT NULL
        )
        ORDER BY rc.rate_card_key
    """)).fetchall()
    print(f"Found {len(rows)} cards:")
    for r in rows:
        print(f"  id={r[0]}, key={r[1]}")

    print("\n=== Rates for MYPKG->AEJEA cards ===")
    cards = conn.execute(text("""
        SELECT id, rate_card_key, terminal_id FROM lcl_rate_cards
        WHERE origin_port_code = 'MYPKG' AND destination_port_code = 'AEJEA'
    """)).fetchall()
    for card in cards:
        print(f"\nCard id={card[0]}, key={card[1]}, terminal={card[2]}")
        rates = conn.execute(text("""
            SELECT id, supplier_id, effective_from, effective_to, rate_status, list_price, cost
            FROM lcl_rates WHERE rate_card_id = :id ORDER BY effective_from DESC
        """), {"id": card[0]}).fetchall()
        for r in rates:
            print(f"  rate {r[0]}: supplier={r[1]}, {r[2]}->{r[3]}, {r[4]}, list={r[5]}, cost={r[6]}")

    print("\n=== Rates for MYPKG->AUBNE cards ===")
    cards = conn.execute(text("""
        SELECT id, rate_card_key, terminal_id FROM lcl_rate_cards
        WHERE origin_port_code = 'MYPKG' AND destination_port_code = 'AUBNE'
    """)).fetchall()
    for card in cards:
        print(f"\nCard id={card[0]}, key={card[1]}, terminal={card[2]}")
        rates = conn.execute(text("""
            SELECT id, supplier_id, effective_from, effective_to, rate_status, list_price, cost
            FROM lcl_rates WHERE rate_card_id = :id ORDER BY effective_from DESC
        """), {"id": card[0]}).fetchall()
        for r in rates:
            print(f"  rate {r[0]}: supplier={r[1]}, {r[2]}->{r[3]}, {r[4]}, list={r[5]}, cost={r[6]}")
