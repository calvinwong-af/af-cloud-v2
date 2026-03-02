"""Backfill missing terminal_id values from Datastore into PostgreSQL.
Targets records where port is set but terminal is NULL.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv; load_dotenv(".env.local")
from core.datastore import get_client
from core.db import get_engine
from sqlalchemy import text

ds = get_client()
engine = get_engine()

with engine.connect() as conn:
    # Find all PG rows where at least one terminal is NULL but port is set
    rows = conn.execute(text("""
        SELECT id FROM shipments
        WHERE migrated_from_v1 = TRUE
          AND (
            (origin_port IS NOT NULL AND origin_terminal IS NULL) OR
            (dest_port IS NOT NULL AND dest_terminal IS NULL)
          )
    """)).fetchall()

    print(f"Rows with missing terminals: {len(rows)}")
    updated = 0
    for row in rows:
        af_id = row[0]
        afcq_id = af_id.replace("AF-", "AFCQ-", 1)
        key = ds.key("ShipmentOrder", afcq_id)
        e = ds.get(key)
        if not e:
            continue

        origin = e.get("origin") or {}
        dest = e.get("destination") or {}
        origin_terminal = origin.get("terminal_id") if isinstance(origin, dict) else None
        dest_terminal = dest.get("terminal_id") if isinstance(dest, dict) else None

        if origin_terminal or dest_terminal:
            conn.execute(text("""
                UPDATE shipments SET
                    origin_terminal = COALESCE(origin_terminal, :ot),
                    dest_terminal = COALESCE(dest_terminal, :dt),
                    updated_at = NOW()
                WHERE id = :id
            """), {"ot": origin_terminal, "dt": dest_terminal, "id": af_id})
            print(f"  {af_id}: origin_terminal={origin_terminal}, dest_terminal={dest_terminal}")
            updated += 1

    conn.commit()
    print(f"\nDone. {updated} records updated.")
