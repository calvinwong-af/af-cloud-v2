"""
migrate_005_remove_mypkg_n.py

Bug 5 — Remove MYPKG_N standalone port row.

MYPKG_N (Port Klang North Port) should only exist as a terminal under MYPKG,
not as its own port row.

Steps:
  1. Check for shipments referencing MYPKG_N as origin/dest port — update to MYPKG + terminal
  2. Delete MYPKG_N from ports table

Run from af-server root with venv active:
    .venv/Scripts/python migrate_005_remove_mypkg_n.py [--dry-run]
"""

import sys
from sqlalchemy import text
from core.db import get_engine

DRY_RUN = '--dry-run' in sys.argv


def main():
    engine = get_engine()
    with engine.connect() as conn:

        # 1. Check if MYPKG_N port exists
        row = conn.execute(
            text("SELECT un_code, name FROM ports WHERE un_code = 'MYPKG_N'")
        ).fetchone()
        if not row:
            print("MYPKG_N not found in ports table — nothing to do.")
            return
        print(f"Found port: {row[0]} — {row[1]}")

        # 2. Check for shipments referencing MYPKG_N as origin or dest
        affected = conn.execute(text("""
            SELECT id, origin_port, dest_port FROM shipments
            WHERE (origin_port = 'MYPKG_N' OR dest_port = 'MYPKG_N')
            AND trash = FALSE
        """)).fetchall()

        if affected:
            print(f"\n{len(affected)} shipment(s) reference MYPKG_N:")
            for r in affected:
                print(f"  {r[0]}: origin={r[1]}, dest={r[2]}")

            if not DRY_RUN:
                # Update origin_port references
                conn.execute(text("""
                    UPDATE shipments
                    SET origin_port = 'MYPKG',
                        origin_terminal = 'MYPKG_N',
                        updated_at = NOW()
                    WHERE origin_port = 'MYPKG_N'
                """))
                # Update dest_port references
                conn.execute(text("""
                    UPDATE shipments
                    SET dest_port = 'MYPKG',
                        dest_terminal = 'MYPKG_N',
                        updated_at = NOW()
                    WHERE dest_port = 'MYPKG_N'
                """))
                print("Updated shipment references: MYPKG_N → MYPKG (terminal=MYPKG_N)")
        else:
            print("No shipments reference MYPKG_N — safe to delete.")

        # 3. Delete MYPKG_N from ports
        if not DRY_RUN:
            conn.execute(text("DELETE FROM ports WHERE un_code = 'MYPKG_N'"))
            conn.commit()
            print("\n✓ Deleted MYPKG_N from ports table.")
        else:
            print("\n[DRY RUN] Would delete MYPKG_N from ports table.")


if __name__ == '__main__':
    main()
