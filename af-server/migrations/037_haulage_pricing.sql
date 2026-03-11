-- Migration 037: Haulage Pricing Schema
--
-- Creates three tables for the haulage pricing module:
--   1. haulage_rate_cards   — route + container size dimension (port × area × size)
--   2. haulage_rates        — time-series pricing rows (perpetual effective_from model)
--   3. port_depot_gate_fees — port-level depot gate fees (shared across all haulage cards)
--
-- Haulage charge components at quotation time:
--   Base rate          → haulage_rates.list_price / cost
--   FAF (HA-FAF)       → haulage_rates.surcharges JSONB
--   Toll fee (HA-TOL)  → haulage_rates.surcharges JSONB
--   Side-loader (HA-SDL) → haulage_rates.side_loader_surcharge (conditional)
--   Depot gate fee     → port_depot_gate_fees.fee_amount (looked up by port/terminal)

-- ============================================================================
-- 1. haulage_rate_cards
-- ============================================================================

CREATE TABLE IF NOT EXISTS haulage_rate_cards (
    id                      SERIAL PRIMARY KEY,
    rate_card_key           VARCHAR(120) NOT NULL UNIQUE,
    -- key format (no terminal):   {port_un_code}:{area_code}:{container_size}
    -- key format (with terminal): {port_un_code}:{terminal_id}:{area_code}:{container_size}
    port_un_code            VARCHAR(10) NOT NULL,
    terminal_id             VARCHAR(20) NULL REFERENCES port_terminals(terminal_id),
    area_id                 INTEGER NOT NULL REFERENCES areas(area_id),
    container_size          VARCHAR(10) NOT NULL,
    include_depot_gate_fee  BOOLEAN NOT NULL DEFAULT FALSE,
    side_loader_available   BOOLEAN NOT NULL DEFAULT FALSE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT haulage_rate_cards_container_size_check
        CHECK (container_size IN ('20', '40', '40HC', 'wildcard')),
    CONSTRAINT haulage_rate_cards_unique_combo
        UNIQUE (port_un_code, terminal_id, area_id, container_size)
);

CREATE INDEX IF NOT EXISTS idx_haulage_rate_cards_port
    ON haulage_rate_cards (port_un_code);

CREATE INDEX IF NOT EXISTS idx_haulage_rate_cards_area
    ON haulage_rate_cards (area_id);

CREATE INDEX IF NOT EXISTS idx_haulage_rate_cards_terminal
    ON haulage_rate_cards (terminal_id)
    WHERE terminal_id IS NOT NULL;

-- ============================================================================
-- 2. haulage_rates
-- ============================================================================

-- Rate resolution: latest row by effective_from where effective_from <= reference_date is active.
-- Query pattern: WHERE rate_card_id = X AND supplier_id = Y
--   AND effective_from <= ref_date ORDER BY effective_from DESC LIMIT 1
-- supplier_id IS NULL = list price reference row (AF selling price)
-- supplier_id IS NOT NULL = supplier cost row
-- side_loader_surcharge: only applied when customer requests side-loader service.
--   If side_loader_available = TRUE on the rate card but side_loader_surcharge IS NULL
--   on the active rate row, treat the service as ON REQUEST (do not silently skip).

CREATE TABLE IF NOT EXISTS haulage_rates (
    id                      SERIAL PRIMARY KEY,
    rate_card_id            INTEGER NOT NULL REFERENCES haulage_rate_cards(id) ON DELETE CASCADE,
    supplier_id             VARCHAR(30) NULL,         -- NULL = list price reference row
    effective_from          DATE NOT NULL,
    effective_to            DATE NULL,                -- NULL = open-ended
    rate_status             rate_status NOT NULL DEFAULT 'PUBLISHED',
    currency                VARCHAR(10) NOT NULL,
    uom                     VARCHAR(20) NOT NULL DEFAULT 'CONTAINER',
    list_price              NUMERIC(12,2) NULL,
    cost                    NUMERIC(12,2) NULL,
    min_list_price          NUMERIC(12,2) NULL,
    min_cost                NUMERIC(12,2) NULL,
    surcharges              JSONB NULL,               -- FAF (HA-FAF) + Toll fee (HA-TOL)
    side_loader_surcharge   NUMERIC(12,2) NULL,       -- HA-SDL: per-supplier conditional surcharge
    roundup_qty             INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_haulage_rates_card
    ON haulage_rates (rate_card_id);

CREATE INDEX IF NOT EXISTS idx_haulage_rates_supplier
    ON haulage_rates (supplier_id)
    WHERE supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_haulage_rates_effective
    ON haulage_rates (rate_card_id, effective_from DESC);

-- ============================================================================
-- 3. port_depot_gate_fees
-- ============================================================================

-- DGF resolution: terminal-specific fee takes priority over port-level fallback.
-- Query pattern: WHERE port_un_code = X
--   AND (terminal_id = Y OR terminal_id IS NULL)
--   AND effective_from <= ref_date
--   ORDER BY terminal_id NULLS LAST, effective_from DESC LIMIT 1
-- Only applied when haulage_rate_cards.include_depot_gate_fee = TRUE.
-- fee_amount is both cost and price basis — no supplier dimension.

CREATE TABLE IF NOT EXISTS port_depot_gate_fees (
    id              SERIAL PRIMARY KEY,
    port_un_code    VARCHAR(10) NOT NULL,
    terminal_id     VARCHAR(20) NULL REFERENCES port_terminals(terminal_id),
    effective_from  DATE NOT NULL,
    effective_to    DATE NULL,
    rate_status     rate_status NOT NULL DEFAULT 'PUBLISHED',
    currency        VARCHAR(10) NOT NULL,
    fee_amount      NUMERIC(12,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT port_depot_gate_fees_unique
        UNIQUE (port_un_code, terminal_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_port_depot_gate_fees_port
    ON port_depot_gate_fees (port_un_code);

CREATE INDEX IF NOT EXISTS idx_port_depot_gate_fees_terminal
    ON port_depot_gate_fees (terminal_id)
    WHERE terminal_id IS NOT NULL;
