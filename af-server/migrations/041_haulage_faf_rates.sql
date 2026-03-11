-- Migration 041: Haulage FAF Rates
--
-- Creates the haulage_faf_rates table for tracking Fuel Adjustment Factor (FAF)
-- percentage agreements between AF and haulage suppliers.
--
-- FAF is a percentage applied to the haulage tariff/cost to account for fuel
-- surcharges. It is managed at the supplier level, scoped per port and container size
-- via a JSONB array (port_rates).
--
-- Resolution:
--   1. Get latest row: WHERE supplier_id = X AND effective_from <= ref_date
--      ORDER BY effective_from DESC LIMIT 1
--   2. Filter port_rates array: match port_un_code = target AND container_size IN (target, 'wildcard')
--   3. Prefer exact container_size match over 'wildcard'
--   4. No match found → ON REQUEST (flag for ops review, do not silently skip)
--
-- port_rates JSONB array entry shape:
--   { "port_un_code": "SGSIN", "container_size": "20", "faf_percent": 0.0500 }
--   container_size: "20" | "40" | "40HC" | "wildcard"
--   wildcard = applies to all container sizes at that port (standard tariff-based hauliers)
--
-- Absolute FAF values are handled separately as HA-FAF surcharges on haulage_rates rows.
-- Coexistence of both is permitted — no conflict detection required.

CREATE TABLE IF NOT EXISTS haulage_faf_rates (
    id              SERIAL PRIMARY KEY,
    supplier_id     VARCHAR(30) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    effective_from  DATE NOT NULL,
    effective_to    DATE NULL,              -- NULL = open-ended
    rate_status     rate_status NOT NULL DEFAULT 'DRAFT',
    port_rates      JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Array of: { port_un_code: string, container_size: "20"|"40"|"40HC"|"wildcard", faf_percent: number }
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT haulage_faf_rates_unique
        UNIQUE (supplier_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_haulage_faf_rates_supplier
    ON haulage_faf_rates (supplier_id);

CREATE INDEX IF NOT EXISTS idx_haulage_faf_rates_effective
    ON haulage_faf_rates (supplier_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_haulage_faf_rates_port_rates
    ON haulage_faf_rates USING GIN (port_rates);
