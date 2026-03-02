"""
scripts/add_document_parse_columns.py

Adds new columns to the shipments table for document parsing features:
  - booking_reference (VARCHAR)
  - hawb_number (VARCHAR)
  - mawb_number (VARCHAR)
  - awb_type (VARCHAR)

All columns use IF NOT EXISTS to be idempotent.

Run with: python -m scripts.add_document_parse_columns
"""

import sys

sys.path.insert(0, ".")

from dotenv import load_dotenv
load_dotenv(".env.local")

from core.db import get_engine
from sqlalchemy import text


MIGRATIONS = [
    "ALTER TABLE shipments ADD COLUMN IF NOT EXISTS booking_reference VARCHAR",
    "ALTER TABLE shipments ADD COLUMN IF NOT EXISTS hawb_number VARCHAR",
    "ALTER TABLE shipments ADD COLUMN IF NOT EXISTS mawb_number VARCHAR",
    "ALTER TABLE shipments ADD COLUMN IF NOT EXISTS awb_type VARCHAR",
]


def main():
    engine = get_engine()

    with engine.connect() as conn:
        for sql in MIGRATIONS:
            conn.execute(text(sql))
            col = sql.split("IF NOT EXISTS ")[1].split(" ")[0]
            print(f"  ✓ {col}")
        conn.commit()

    print(f"\nDone. {len(MIGRATIONS)} column migrations applied.")


if __name__ == "__main__":
    main()
