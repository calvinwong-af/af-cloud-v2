"""
scripts/run_migration_010_011.py — Run migrations 010 + 011.

010: Rename haulage_areas → areas
011: Unified orders architecture

Verifies row counts match before/after. Prints summary.

Usage:
    cd af-server
    .venv/Scripts/python scripts/run_migration_010_011.py
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
    with engine.connect() as conn:
        # --- Pre-migration counts ---
        shipment_count = conn.execute(text("SELECT COUNT(*) FROM shipments")).scalar() or 0
        gt_count = conn.execute(text("SELECT COUNT(*) FROM ground_transport_orders")).scalar() or 0
        gt_leg_count = conn.execute(text("SELECT COUNT(*) FROM ground_transport_legs")).scalar() or 0

        print(f"Pre-migration counts:")
        print(f"  shipments: {shipment_count}")
        print(f"  ground_transport_orders: {gt_count}")
        print(f"  ground_transport_legs: {gt_leg_count}")
        print()

        # --- Migration 010: Rename haulage_areas → areas ---
        print("Running migration 010 (rename haulage_areas → areas)...")
        migration_010 = open(
            os.path.join(os.path.dirname(__file__), "..", "migrations", "010_rename_haulage_areas.sql")
        ).read()
        for stmt in migration_010.split(";"):
            stmt = stmt.strip()
            if stmt and not stmt.startswith("--"):
                try:
                    conn.execute(text(stmt))
                except Exception as e:
                    print(f"  Warning on 010 statement: {e}")
        conn.commit()
        print("  Migration 010 complete.")
        print()

        # --- Migration 011: Unified orders ---
        print("Running migration 011 (unified orders)...")
        migration_011 = open(
            os.path.join(os.path.dirname(__file__), "..", "migrations", "011_unified_orders.sql")
        ).read()
        for stmt in migration_011.split(";"):
            stmt = stmt.strip()
            if stmt and not stmt.startswith("--"):
                try:
                    conn.execute(text(stmt))
                except Exception as e:
                    print(f"  Warning on 011 statement: {e}")
        conn.commit()
        print("  Migration 011 complete.")
        print()

        # --- Post-migration verification ---
        order_count = conn.execute(text("SELECT COUNT(*) FROM orders")).scalar() or 0
        shipment_order_count = conn.execute(text(
            "SELECT COUNT(*) FROM orders WHERE order_type = 'shipment'"
        )).scalar() or 0
        transport_order_count = conn.execute(text(
            "SELECT COUNT(*) FROM orders WHERE order_type = 'transport'"
        )).scalar() or 0
        detail_count = conn.execute(text("SELECT COUNT(*) FROM shipment_details")).scalar() or 0
        stop_count = conn.execute(text("SELECT COUNT(*) FROM order_stops")).scalar() or 0
        leg_count = conn.execute(text("SELECT COUNT(*) FROM order_legs")).scalar() or 0

        print(f"Post-migration counts:")
        print(f"  orders (total): {order_count}")
        print(f"  orders (shipment): {shipment_order_count}")
        print(f"  orders (transport): {transport_order_count}")
        print(f"  shipment_details: {detail_count}")
        print(f"  order_stops: {stop_count}")
        print(f"  order_legs: {leg_count}")
        print()

        # Verify
        expected_orders = shipment_count + gt_count
        if order_count == expected_orders:
            print(f"  PASS: orders count ({order_count}) = shipments ({shipment_count}) + GT ({gt_count})")
        else:
            print(f"  FAIL: orders count ({order_count}) != shipments ({shipment_count}) + GT ({gt_count}) = {expected_orders}")

        if shipment_order_count == shipment_count:
            print(f"  PASS: shipment orders ({shipment_order_count}) = shipments ({shipment_count})")
        else:
            print(f"  FAIL: shipment orders ({shipment_order_count}) != shipments ({shipment_count})")

        if detail_count == shipment_count:
            print(f"  PASS: shipment_details ({detail_count}) = shipments ({shipment_count})")
        else:
            print(f"  FAIL: shipment_details ({detail_count}) != shipments ({shipment_count})")

        if transport_order_count == gt_count:
            print(f"  PASS: transport orders ({transport_order_count}) = GT orders ({gt_count})")
        else:
            print(f"  FAIL: transport orders ({transport_order_count}) != GT orders ({gt_count})")

        # Stops: each GT leg creates 2 stops (origin + dest)
        expected_stops = gt_leg_count * 2
        if stop_count == expected_stops:
            print(f"  PASS: order_stops ({stop_count}) = GT legs * 2 ({expected_stops})")
        else:
            print(f"  FAIL: order_stops ({stop_count}) != GT legs * 2 ({expected_stops})")

        if leg_count == gt_leg_count:
            print(f"  PASS: order_legs ({leg_count}) = GT legs ({gt_leg_count})")
        else:
            print(f"  FAIL: order_legs ({leg_count}) != GT legs ({gt_leg_count})")

        # Check areas table exists
        areas_count = conn.execute(text("SELECT COUNT(*) FROM areas")).scalar() or 0
        print(f"  areas table: {areas_count} rows")

        print()
        print("Migration complete. Legacy tables preserved as _legacy_*.")
        print("DO NOT drop legacy tables until Calvin confirms everything works.")


if __name__ == "__main__":
    run()
