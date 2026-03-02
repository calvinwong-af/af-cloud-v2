"""
SD-02 Diagnostic — Verify soft-deleted shipment has trash=TRUE in PostgreSQL.
Run from: af-server/ directory (so .env.local and venv are available).

Usage:
    python check_sd02.py
"""

import os
from dotenv import load_dotenv
load_dotenv('.env.local')

from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env.local")
    exit(1)

engine = create_engine(DATABASE_URL)

SHIPMENT_ID = "AF-003865"

with engine.connect() as conn:
    row = conn.execute(text("""
        SELECT id, status, trash, updated_at
        FROM shipments
        WHERE id = :id
    """), {"id": SHIPMENT_ID}).fetchone()

    if row is None:
        print(f"RESULT: {SHIPMENT_ID} — NOT FOUND in shipments table (hard deleted or never existed)")
    else:
        print(f"RESULT: {SHIPMENT_ID}")
        print(f"  status     : {row[1]}")
        print(f"  trash      : {row[2]}")
        print(f"  updated_at : {row[3]}")
        if row[2] is True:
            print("  ✓ SD-02 PASS — row exists with trash=TRUE")
        else:
            print("  ✗ SD-02 FAIL — row exists but trash is not TRUE")
