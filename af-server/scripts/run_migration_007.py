"""
scripts/run_migration_007.py

Run migration 007 — seeds China provinces/municipalities/regions into states table.

Usage (from af-server directory, with Cloud SQL Auth Proxy running):
    python scripts/run_migration_007.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

from sqlalchemy import text
from core.db import get_engine

INSERT_SQL = """
INSERT INTO states (state_code, name, country_code) VALUES
  ('CN-BJ', 'Beijing', 'CN'),
  ('CN-TJ', 'Tianjin', 'CN'),
  ('CN-SH', 'Shanghai', 'CN'),
  ('CN-CQ', 'Chongqing', 'CN'),
  ('CN-HE', 'Hebei', 'CN'),
  ('CN-SX', 'Shanxi', 'CN'),
  ('CN-LN', 'Liaoning', 'CN'),
  ('CN-JL', 'Jilin', 'CN'),
  ('CN-HL', 'Heilongjiang', 'CN'),
  ('CN-JS', 'Jiangsu', 'CN'),
  ('CN-ZJ', 'Zhejiang', 'CN'),
  ('CN-AH', 'Anhui', 'CN'),
  ('CN-FJ', 'Fujian', 'CN'),
  ('CN-JX', 'Jiangxi', 'CN'),
  ('CN-SD', 'Shandong', 'CN'),
  ('CN-HA', 'Henan', 'CN'),
  ('CN-HB', 'Hubei', 'CN'),
  ('CN-HN', 'Hunan', 'CN'),
  ('CN-GD', 'Guangdong', 'CN'),
  ('CN-HI', 'Hainan', 'CN'),
  ('CN-SC', 'Sichuan', 'CN'),
  ('CN-GZ', 'Guizhou', 'CN'),
  ('CN-YN', 'Yunnan', 'CN'),
  ('CN-SN', 'Shaanxi', 'CN'),
  ('CN-GS', 'Gansu', 'CN'),
  ('CN-QH', 'Qinghai', 'CN'),
  ('CN-NM', 'Inner Mongolia', 'CN'),
  ('CN-GX', 'Guangxi', 'CN'),
  ('CN-XZ', 'Tibet', 'CN'),
  ('CN-NX', 'Ningxia', 'CN'),
  ('CN-XJ', 'Xinjiang', 'CN'),
  ('CN-HK', 'Hong Kong', 'CN'),
  ('CN-MO', 'Macao', 'CN')
ON CONFLICT (state_code) DO NOTHING
"""


def main():
    print("Running migration 007: China provinces seed...")

    engine = get_engine()
    with engine.connect() as conn:
        conn.execute(text(INSERT_SQL))
        conn.commit()

        row = conn.execute(text("SELECT COUNT(*) FROM states WHERE country_code = 'CN'")).fetchone()
        print(f"Migration 007 complete. CN states: {row[0]}")


if __name__ == "__main__":
    main()
