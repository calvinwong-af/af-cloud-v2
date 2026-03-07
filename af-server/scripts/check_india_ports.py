"""
scripts/check_india_ports.py — Check if INTKD / INWFD ports and terminals exist.

Usage:
    cd af-server
    .venv/Scripts/python scripts/check_india_ports.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

from sqlalchemy import text
from core.db import get_engine


def run():
    engine = get_engine()

    port_codes = ("INTKD", "INWFD")
    terminal_codes = ("INTKD6", "INWFD6")

    with engine.connect() as conn:

        # 1. Check parent ports
        rows = conn.execute(text("""
            SELECT un_code, name, has_terminals
            FROM ports
            WHERE un_code = ANY(:codes)
            ORDER BY un_code
        """), {"codes": list(port_codes)}).fetchall()

        print("\n── Parent ports ──────────────────────────")
        if rows:
            for r in rows:
                print(f"  {r[0]}  {r[1]}  (has_terminals={r[2]})")
        else:
            print("  None found.")

        found_ports = {r[0] for r in rows}
        missing_ports = set(port_codes) - found_ports
        if missing_ports:
            print(f"\n  ⚠ Missing from ports table: {', '.join(sorted(missing_ports))}")

        # 2. Check existing terminals
        rows = conn.execute(text("""
            SELECT terminal_id, port_un_code, name, is_default
            FROM port_terminals
            WHERE terminal_id = ANY(:codes)
            ORDER BY terminal_id
        """), {"codes": list(terminal_codes)}).fetchall()

        print("\n── port_terminals ────────────────────────")
        if rows:
            for r in rows:
                print(f"  {r[0]}  →  {r[1]}  '{r[2]}'  (default={r[3]})")
        else:
            print("  None found.")

        # 3. Check how many rate cards reference these codes
        for code in terminal_codes:
            fcl = conn.execute(text("""
                SELECT COUNT(*) FROM fcl_rate_cards
                WHERE destination_port_code = :code
                   OR origin_port_code = :code
            """), {"code": code}).fetchone()[0]
            lcl = conn.execute(text("""
                SELECT COUNT(*) FROM lcl_rate_cards
                WHERE destination_port_code = :code
                   OR origin_port_code = :code
            """), {"code": code}).fetchone()[0]
            print(f"\n  Rate cards referencing {code}:")
            print(f"    FCL: {fcl}  LCL: {lcl}")

        print()


if __name__ == "__main__":
    run()
