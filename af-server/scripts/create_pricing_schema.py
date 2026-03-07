"""
scripts/create_pricing_schema.py — Add pricing tables to existing prod schema.

Adds ONLY the pricing-related objects:
  - rate_status enum
  - fcl_rate_cards + fcl_rates tables + indexes
  - lcl_rate_cards + lcl_rates tables + indexes

Idempotent: safe to re-run. Does not touch any existing tables.

Usage:
    cd af-server
    .venv/Scripts/python scripts/create_pricing_schema.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

from sqlalchemy import text
from core.db import get_engine

PRICING_SQL = """
CREATE TABLE IF NOT EXISTS fcl_rate_cards (
    id                      SERIAL          PRIMARY KEY,
    rate_card_key           TEXT            NOT NULL UNIQUE,
    origin_port_code        TEXT            NOT NULL,
    destination_port_code   TEXT            NOT NULL,
    dg_class_code           TEXT            NOT NULL,
    container_size          TEXT            NOT NULL,
    container_type          TEXT            NOT NULL,
    code                    TEXT            NOT NULL,
    description             TEXT            NOT NULL,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fcl_rate_cards_ports
    ON fcl_rate_cards (origin_port_code, destination_port_code, dg_class_code);
CREATE INDEX IF NOT EXISTS idx_fcl_rate_cards_active
    ON fcl_rate_cards (is_active);

CREATE TABLE IF NOT EXISTS fcl_rates (
    id                      SERIAL          PRIMARY KEY,
    rate_card_id            INTEGER         NOT NULL REFERENCES fcl_rate_cards(id) ON DELETE CASCADE,
    supplier_id             TEXT,
    effective_from          DATE            NOT NULL,
    rate_status             rate_status     NOT NULL DEFAULT 'PUBLISHED',
    currency                TEXT            NOT NULL,
    uom                     TEXT            NOT NULL DEFAULT 'CONTAINER',
    list_price              NUMERIC(12,4),
    min_list_price          NUMERIC(12,4),
    cost                    NUMERIC(12,4),
    min_cost                NUMERIC(12,4),
    roundup_qty             INTEGER         NOT NULL DEFAULT 0,
    lss                     NUMERIC(12,4)   NOT NULL DEFAULT 0,
    baf                     NUMERIC(12,4)   NOT NULL DEFAULT 0,
    ecrs                    NUMERIC(12,4)   NOT NULL DEFAULT 0,
    psc                     NUMERIC(12,4)   NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fcl_rates_lookup
    ON fcl_rates (rate_card_id, supplier_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_fcl_rates_effective
    ON fcl_rates (effective_from DESC);

CREATE TABLE IF NOT EXISTS lcl_rate_cards (
    id                      SERIAL          PRIMARY KEY,
    rate_card_key           TEXT            NOT NULL UNIQUE,
    origin_port_code        TEXT            NOT NULL,
    destination_port_code   TEXT            NOT NULL,
    dg_class_code           TEXT            NOT NULL,
    code                    TEXT            NOT NULL,
    description             TEXT            NOT NULL,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lcl_rate_cards_ports
    ON lcl_rate_cards (origin_port_code, destination_port_code, dg_class_code);
CREATE INDEX IF NOT EXISTS idx_lcl_rate_cards_active
    ON lcl_rate_cards (is_active);

CREATE TABLE IF NOT EXISTS lcl_rates (
    id                      SERIAL          PRIMARY KEY,
    rate_card_id            INTEGER         NOT NULL REFERENCES lcl_rate_cards(id) ON DELETE CASCADE,
    supplier_id             TEXT,
    effective_from          DATE            NOT NULL,
    rate_status             rate_status     NOT NULL DEFAULT 'PUBLISHED',
    currency                TEXT            NOT NULL,
    uom                     TEXT            NOT NULL DEFAULT 'W/M',
    list_price              NUMERIC(12,4),
    min_list_price          NUMERIC(12,4),
    cost                    NUMERIC(12,4),
    min_cost                NUMERIC(12,4),
    roundup_qty             INTEGER         NOT NULL DEFAULT 0,
    lss                     NUMERIC(12,4)   NOT NULL DEFAULT 0,
    baf                     NUMERIC(12,4)   NOT NULL DEFAULT 0,
    ecrs                    NUMERIC(12,4)   NOT NULL DEFAULT 0,
    psc                     NUMERIC(12,4)   NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lcl_rates_lookup
    ON lcl_rates (rate_card_id, supplier_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_lcl_rates_effective
    ON lcl_rates (effective_from DESC);
"""


def main():
    engine = get_engine()
    with engine.connect() as conn:
        # Create rate_status enum (idempotent via DO block)
        print("Creating rate_status enum...")
        conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE rate_status AS ENUM ('PUBLISHED', 'ON_REQUEST');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$
        """))
        print("  OK")

        # Create pricing tables + indexes
        print("Creating pricing tables...")
        for statement in PRICING_SQL.split(";"):
            stmt = statement.strip()
            if stmt and not stmt.startswith("--"):
                conn.execute(text(stmt))
        conn.commit()
        print("  OK")

    print("\nPricing schema created successfully.")
    print("Tables: fcl_rate_cards, fcl_rates, lcl_rate_cards, lcl_rates")


if __name__ == "__main__":
    main()
