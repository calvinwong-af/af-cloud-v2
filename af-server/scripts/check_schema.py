"""
Standalone schema check — verifies terminal_id column exists on rate card tables.
Run this independently of the migration runner to confirm DB state.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(".env.local")
from sqlalchemy import text
from core.db import get_engine

engine = get_engine()
with engine.connect() as conn:
    rows = conn.execute(text("""
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_name IN ('fcl_rate_cards', 'lcl_rate_cards')
          AND column_name = 'terminal_id'
        ORDER BY table_name
    """)).fetchall()
    if rows:
        print("terminal_id found on:", [r[0] for r in rows])
    else:
        print("terminal_id NOT FOUND on either table — column does not exist in DB")

    # Also check all columns on fcl_rate_cards
    all_cols = conn.execute(text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'fcl_rate_cards'
        ORDER BY ordinal_position
    """)).fetchall()
    print("fcl_rate_cards columns:", [r[0] for r in all_cols])
