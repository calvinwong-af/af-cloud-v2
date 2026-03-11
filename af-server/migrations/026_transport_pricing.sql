-- ============================================================
-- DEPRECATED — Do not run this migration.
-- Superseded by the geography restructure (migration 028+).
-- This file is retained for historical reference only.
-- ============================================================

-- Migration 026: Port Transport rate cards + rates
-- Covers type 2 transport: port to area (freight pickup/delivery)
-- Future transport types:
--   gen_transport_rate_cards / gen_transport_rates  (type 1: area to area, general delivery)
--   cb_transport_rate_cards  / cb_transport_rates   (type 3: area to area, cross-border)

-- Drop and recreate with updated schema (terminal_id support)
DROP TABLE IF EXISTS port_transport_rates CASCADE;
DROP TABLE IF EXISTS port_transport_rate_cards CASCADE;

-- Port Transport Rate Cards
CREATE TABLE IF NOT EXISTS port_transport_rate_cards (
    id                      SERIAL PRIMARY KEY,
    rate_card_key           VARCHAR(80) NOT NULL UNIQUE,  -- e.g. MYPKG:MYPKG_N:12:lorry_3t (terminal included when present, else MYPKG:12:lorry_3t)
    port_un_code            VARCHAR(10) NOT NULL,
    terminal_id             VARCHAR(20) NULL REFERENCES port_terminals(terminal_id),
    area_id                 INTEGER NOT NULL REFERENCES areas(area_id),
    vehicle_type_id         VARCHAR(30) NOT NULL REFERENCES vehicle_types(vehicle_type_id),
    include_depot_gate_fee  BOOLEAN NOT NULL DEFAULT FALSE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (port_un_code, terminal_id, area_id, vehicle_type_id)
);

-- Port Transport Rates
CREATE TABLE IF NOT EXISTS port_transport_rates (
    id              SERIAL PRIMARY KEY,
    rate_card_id    INTEGER NOT NULL REFERENCES port_transport_rate_cards(id) ON DELETE CASCADE,
    supplier_id     VARCHAR(30) NULL,        -- NULL = list price reference row
    effective_from  DATE NOT NULL,
    effective_to    DATE NULL,               -- NULL = open-ended
    rate_status     rate_status NOT NULL DEFAULT 'PUBLISHED',
    currency        VARCHAR(10) NOT NULL,
    uom             VARCHAR(20) NOT NULL DEFAULT 'SET',
    list_price      NUMERIC(12,2) NULL,
    cost            NUMERIC(12,2) NULL,
    min_list_price  NUMERIC(12,2) NULL,      -- minimum billable list price
    min_cost        NUMERIC(12,2) NULL,      -- minimum billable cost
    surcharges      JSONB NULL,
    roundup_qty     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_port_transport_rates_card ON port_transport_rates(rate_card_id);
CREATE INDEX IF NOT EXISTS idx_port_transport_rates_supplier ON port_transport_rates(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_port_transport_rate_cards_port ON port_transport_rate_cards(port_un_code);
CREATE INDEX IF NOT EXISTS idx_port_transport_rate_cards_terminal ON port_transport_rate_cards(terminal_id) WHERE terminal_id IS NOT NULL;

-- Seed: catch-all delivery areas missing from initial haulage_areas migration
INSERT INTO areas (area_code, area_name, port_un_code, state_code, is_active)
VALUES
    ('MY-KUL-000', 'Kuala Lumpur (General)', 'MYPKG', 'MY-KUL', true),
    ('MY-MLK-000', 'Melaka (General)',        'MYPKG', 'MY-MLK', true)
ON CONFLICT (area_code, port_un_code) DO NOTHING;
