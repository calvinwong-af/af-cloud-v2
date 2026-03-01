"""
scripts/create_schema.py — Create PostgreSQL schema for AF Server V2.

Idempotent: uses IF NOT EXISTS throughout. Safe to re-run.

Usage:
    cd af-server
    .venv/Scripts/python scripts/create_schema.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

from sqlalchemy import text
from core.db import get_engine

SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS companies (
    id                  TEXT        PRIMARY KEY,
    name                TEXT        NOT NULL,
    short_name          TEXT,
    account_type        TEXT        NOT NULL DEFAULT 'AFC',
    email               TEXT,
    phone               TEXT,
    address             JSONB,
    xero_contact_id     TEXT,
    approved            BOOLEAN     NOT NULL DEFAULT FALSE,
    has_platform_access BOOLEAN     NOT NULL DEFAULT FALSE,
    trash               BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies USING GIN (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS shipments (
    id                  TEXT        PRIMARY KEY,
    countid             BIGINT      UNIQUE NOT NULL,
    company_id          TEXT        NOT NULL REFERENCES companies(id),
    order_type          TEXT        NOT NULL DEFAULT 'SEA_FCL',
    transaction_type    TEXT        NOT NULL DEFAULT 'IMPORT',
    incoterm_code       TEXT,
    status              INTEGER     NOT NULL DEFAULT 1001,
    issued_invoice      BOOLEAN     NOT NULL DEFAULT FALSE,
    migrated_from_v1    BOOLEAN     NOT NULL DEFAULT FALSE,
    trash               BOOLEAN     NOT NULL DEFAULT FALSE,
    origin_port         TEXT,
    origin_terminal     TEXT,
    dest_port           TEXT,
    dest_terminal       TEXT,
    cargo_ready_date    DATE,
    etd                 TIMESTAMPTZ,
    eta                 TIMESTAMPTZ,
    cargo               JSONB,
    booking             JSONB,
    parties             JSONB,
    bl_document         JSONB,
    type_details        JSONB,
    exception_data      JSONB,
    route_nodes         JSONB,
    status_history      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    creator             JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shipments_company   ON shipments (company_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status    ON shipments (status);
CREATE INDEX IF NOT EXISTS idx_shipments_tab       ON shipments (status, issued_invoice, trash);
CREATE INDEX IF NOT EXISTS idx_shipments_active    ON shipments (company_id, status) WHERE trash = FALSE;
CREATE INDEX IF NOT EXISTS idx_shipments_updated   ON shipments (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_id_trgm   ON shipments USING GIN (id gin_trgm_ops);

CREATE TABLE IF NOT EXISTS shipment_workflows (
    shipment_id         TEXT        PRIMARY KEY REFERENCES shipments(id) ON DELETE CASCADE,
    company_id          TEXT        NOT NULL,
    workflow_tasks      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    status_history      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    completed           BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipment_files (
    id                  BIGSERIAL   PRIMARY KEY,
    shipment_id         TEXT        NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    company_id          TEXT        NOT NULL,
    file_name           TEXT        NOT NULL,
    file_location       TEXT        NOT NULL,
    file_tags           TEXT[]      NOT NULL DEFAULT '{}',
    file_description    TEXT,
    file_size_kb        NUMERIC(10,2),
    visibility          BOOLEAN     NOT NULL DEFAULT TRUE,
    notification_sent   BOOLEAN     NOT NULL DEFAULT FALSE,
    uploaded_by_uid     TEXT,
    uploaded_by_email   TEXT,
    trash               BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_files_shipment ON shipment_files (shipment_id) WHERE trash = FALSE;

CREATE TABLE IF NOT EXISTS ports (
    un_code             TEXT        PRIMARY KEY,
    name                TEXT        NOT NULL,
    country             TEXT,
    country_code        TEXT,
    port_type           TEXT        NOT NULL DEFAULT 'SEA',
    has_terminals       BOOLEAN     NOT NULL DEFAULT FALSE,
    terminals           JSONB       NOT NULL DEFAULT '[]'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS file_tags (
    id                  TEXT        PRIMARY KEY,
    label               TEXT        NOT NULL,
    color               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_logs (
    id                  BIGSERIAL   PRIMARY KEY,
    action              TEXT        NOT NULL,
    entity_id           TEXT,
    uid                 TEXT,
    email               TEXT,
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_system_logs_entity  ON system_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs (created_at DESC);

CREATE SEQUENCE IF NOT EXISTS shipment_countid_seq START WITH 1 INCREMENT BY 1;
"""


def main():
    engine = get_engine()
    with engine.connect() as conn:
        for statement in SCHEMA_SQL.split(";"):
            stmt = statement.strip()
            if stmt:
                conn.execute(text(stmt))
        conn.commit()
    print("Schema created successfully")


if __name__ == "__main__":
    main()
