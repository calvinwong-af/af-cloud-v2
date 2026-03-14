-- Migration 062: currency_rate_pairs + fx_snapshot on quotations
--
-- 1. currency_rate_pairs — pair-level metadata (adjustment %, active flag).
--    The currency_rates table continues to hold raw weekly rate rows.
--    Pairs are now explicit; all existing distinct pairs are seeded into this table.
--
-- 2. quotations.fx_snapshot — JSONB column storing the FX rates + adjustments
--    used at the time a quotation is calculated/recalculated.

CREATE TABLE currency_rate_pairs (
    id                  SERIAL          PRIMARY KEY,
    base_currency       VARCHAR(3)      NOT NULL,
    target_currency     VARCHAR(3)      NOT NULL,
    adjustment_pct      NUMERIC(8, 4)   NOT NULL DEFAULT 0,
    -- % markup/markdown applied on top of raw rate at calculation time.
    -- effective_rate = raw_rate * (1 + adjustment_pct / 100)
    -- Default 0 = no adjustment. Can be negative.
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    notes               TEXT            NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT crp_unique UNIQUE (base_currency, target_currency),
    CONSTRAINT crp_no_self CHECK (base_currency <> target_currency)
);

CREATE TRIGGER trg_crp_updated_at
    BEFORE UPDATE ON currency_rate_pairs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed all existing distinct pairs from currency_rates
INSERT INTO currency_rate_pairs (base_currency, target_currency)
SELECT DISTINCT base_currency, target_currency
FROM currency_rates
ON CONFLICT (base_currency, target_currency) DO NOTHING;

-- fx_snapshot on quotations
ALTER TABLE quotations
    ADD COLUMN fx_snapshot JSONB NOT NULL DEFAULT '{}';
