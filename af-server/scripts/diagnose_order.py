"""
scripts/diagnose_order.py — Quick diagnostic for a specific order ID.

Prints the key columns from orders + shipment_details to identify
why a shipment might not appear in the list.

Usage:
    cd af-server
    .venv/Scripts/python scripts/diagnose_order.py AF-003859
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

from sqlalchemy import text
from core.db import get_engine


def main():
    order_id = sys.argv[1] if len(sys.argv) > 1 else "AF-003859"

    engine = get_engine()
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT
                o.order_id,
                o.order_type,
                o.status,
                o.sub_status,
                o.completed,
                o.trash,
                o.migrated_from_v1,
                o.is_test,
                sd.order_type_detail,
                sd.incoterm_code,
                sd.transaction_type,
                sd.origin_port,
                sd.dest_port
            FROM orders o
            LEFT JOIN shipment_details sd ON sd.order_id = o.order_id
            WHERE o.order_id = :id
        """), {"id": order_id}).fetchone()

        if not row:
            # Try without trash filter — maybe it's trashed
            row = conn.execute(text("""
                SELECT
                    o.order_id,
                    o.order_type,
                    o.status,
                    o.sub_status,
                    o.completed,
                    o.trash,
                    o.migrated_from_v1,
                    o.is_test,
                    sd.order_type_detail,
                    sd.incoterm_code,
                    sd.transaction_type,
                    sd.origin_port,
                    sd.dest_port
                FROM orders o
                LEFT JOIN shipment_details sd ON sd.order_id = o.order_id
                WHERE o.order_id = :id
            """), {"id": order_id}).fetchone()
            if row:
                print(f"⚠️  Record found but may be hidden (trash/completed/wrong type)")
            else:
                print(f"❌ Record {order_id} not found in orders table at all!")
                return

        labels = [
            "order_id", "order_type", "status", "sub_status",
            "completed", "trash", "migrated_from_v1", "is_test",
            "order_type_detail", "incoterm_code", "transaction_type",
            "origin_port", "dest_port"
        ]

        print(f"\n{'='*50}")
        print(f"  Diagnostic: {order_id}")
        print(f"{'='*50}")
        for label, val in zip(labels, row):
            flag = ""
            if label == "order_type" and val != "shipment":
                flag = "  ⚠️  PROBLEM: must be 'shipment' for list query to include it"
            if label == "trash" and val:
                flag = "  ⚠️  PROBLEM: record is soft-deleted"
            if label == "completed" and val:
                flag = "  ℹ️  Record is marked completed"
            if label == "is_test" and val:
                flag = "  ℹ️  Record is a test order"
            print(f"  {label:<22} = {val!r}{flag}")

        print()

        # Check if it would be caught by Active tab
        order_type = row[1]
        status = row[2]
        completed = row[4]
        trash = row[5]

        active_filter = status in ('confirmed', 'in_progress') and not completed
        in_list = not trash and order_type == 'shipment'

        print(f"  Would appear in list?  trash=False + order_type='shipment' → {in_list}")
        print(f"  Would appear in Active? status in (confirmed/in_progress) + not completed → {active_filter}")

        if not in_list or not active_filter:
            print(f"\n  ❌ NOT visible in Active list. Reasons above.")
        else:
            print(f"\n  ✅ Should be visible in Active list — check pagination or frontend filter.")


if __name__ == "__main__":
    main()
