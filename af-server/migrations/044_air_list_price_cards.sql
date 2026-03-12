-- Migration 044: Air List Price Rate Cards
--
-- Structural refactor: decouples list price (customer-facing selling price)
-- from per-airline rate cards.
--
-- Business rationale:
--   AcceleFreight sets ONE selling price per O/D+DG route, compared against
--   ALL airline supplier costs. The previous model stored list price as
--   supplier_id IS NULL rows on air_freight_rate_cards (which is per-airline),
--   creating incorrect coupling. A single KUL→BAH NON-DG list price was
--   duplicated across every airline card for that route.
--
-- New model:
--   air_list_price_rate_cards  — one record per O/D+DG combination
--   air_list_price_rates       — time-series list price rows (perpetual
--                                effective_from model, same as all other modules)
--
-- Key format: ORIGIN:DEST:DG_CLASS
--   e.g. KUL:BAH:NON-DG
--
-- air_freight_rates continues to hold supplier cost rows only
-- (supplier_id IS NOT NULL). The supplier_id IS NULL rows are migrated in
-- migration 045 and can be deleted post-verification.
--
-- Breakpoints: l45, p45, p100, p250, p300, p500, p1000 (per kg) + min floor.
-- Surcharges: JSONB — same structure as air_freight_rates.surcharges.
-- No supplier_id dimension — list price is route-level only.

-- ---------------------------------------------------------------------------
-- 1. air_list_price_rate_cards
-- ---------------------------------------------------------------------------

CREATE TABLE air_list_price_rate_cards (
    id                      SERIAL PRIMARY KEY,
    rate_card_key           TEXT        NOT NULL UNIQUE,   -- ORIGIN:DEST:DG_CLASS
    origin_port_code        TEXT        NOT NULL,
    destination_port_code   TEXT        NOT NULL,
    dg_class_code           TEXT        NOT NULL,          -- NON-DG | DG-2 | DG-3
    code                    TEXT        NOT NULL DEFAULT 'FR-AIR',
    description             TEXT        NOT NULL DEFAULT '',
    is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_air_lp_rc_origin  ON air_list_price_rate_cards (origin_port_code);
CREATE INDEX idx_air_lp_rc_dest    ON air_list_price_rate_cards (destination_port_code);
CREATE INDEX idx_air_lp_rc_active  ON air_list_price_rate_cards (is_active);

-- ---------------------------------------------------------------------------
-- 2. air_list_price_rates
-- ---------------------------------------------------------------------------
-- Rate resolution: latest row by effective_from where effective_from <= reference_date.
-- effective_to IS NULL = open-ended (in perpetuity until notified).
-- effective_to IS NOT NULL = end-dated quotation from agent/airline.
--
-- Query pattern:
--   SELECT * FROM air_list_price_rates
--   WHERE rate_card_id = :id AND rate_status = 'PUBLISHED'
--     AND effective_from <= :ref_date
--     AND (effective_to IS NULL OR effective_to >= :ref_date)
--   ORDER BY effective_from DESC LIMIT 1;

CREATE TABLE air_list_price_rates (
    id                  SERIAL PRIMARY KEY,
    rate_card_id        INTEGER     NOT NULL REFERENCES air_list_price_rate_cards(id) ON DELETE CASCADE,
    effective_from      DATE        NOT NULL,
    effective_to        DATE,                             -- NULL = open-ended
    rate_status         rate_status NOT NULL DEFAULT 'PUBLISHED',
    currency            TEXT        NOT NULL,

    -- Breakpoint tiers — list price (per kg)
    l45_list_price      NUMERIC(12, 4),   -- less than 45 kg
    p45_list_price      NUMERIC(12, 4),   -- +45 kg
    p100_list_price     NUMERIC(12, 4),   -- +100 kg
    p250_list_price     NUMERIC(12, 4),   -- +250 kg
    p300_list_price     NUMERIC(12, 4),   -- +300 kg
    p500_list_price     NUMERIC(12, 4),   -- +500 kg
    p1000_list_price    NUMERIC(12, 4),   -- +1000 kg
    min_list_price      NUMERIC(12, 4),   -- minimum charge floor

    -- Surcharges JSONB — keys: fsc, msc, ssc (per-kg amounts)
    surcharges          JSONB,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate resolution index
CREATE INDEX idx_air_lp_rates_card_eff
    ON air_list_price_rates (rate_card_id, effective_from DESC);

-- Active published rates index (quotation hot path)
CREATE INDEX idx_air_lp_rates_published
    ON air_list_price_rates (rate_card_id, effective_from DESC)
    WHERE rate_status = 'PUBLISHED';
