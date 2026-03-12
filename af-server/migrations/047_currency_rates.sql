-- Migration 047: currency_rates table
--
-- Creates a time-series currency conversion table using the standard
-- effective_from perpetual model (latest row WHERE effective_from <= ref_date).
--
-- Replaces the legacy Google Cloud Datastore CurrencyConversion Kind.
-- Seed data (effective_from = 2026-01-01) is applied by the separate
-- data migration script: scripts/migrate_currency_rates.py

CREATE TABLE currency_rates (
    id              SERIAL PRIMARY KEY,
    base_currency   VARCHAR(3)      NOT NULL,
    target_currency VARCHAR(3)      NOT NULL,
    rate            NUMERIC(14, 6)  NOT NULL CHECK (rate > 0),
    effective_from  DATE            NOT NULL,
    notes           TEXT            NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT currency_rates_unique UNIQUE (base_currency, target_currency, effective_from),
    CONSTRAINT currency_rates_no_self CHECK (base_currency <> target_currency)
);

CREATE INDEX idx_currency_rates_lookup
    ON currency_rates (base_currency, target_currency, effective_from DESC);

-- updated_at trigger (reuse existing function if available)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
    ) THEN
        CREATE FUNCTION set_updated_at()
        RETURNS TRIGGER LANGUAGE plpgsql AS $func$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $func$;
    END IF;
END;
$$;

CREATE TRIGGER trg_currency_rates_updated_at
    BEFORE UPDATE ON currency_rates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
