-- Migration 034: Drop deprecated flat surcharge columns from fcl_rates and lcl_rates
-- Data was migrated to surcharges JSONB in migration 018 (v5.38).

ALTER TABLE fcl_rates
    DROP COLUMN IF EXISTS lss,
    DROP COLUMN IF EXISTS baf,
    DROP COLUMN IF EXISTS ecrs,
    DROP COLUMN IF EXISTS psc;

ALTER TABLE lcl_rates
    DROP COLUMN IF EXISTS lss,
    DROP COLUMN IF EXISTS baf,
    DROP COLUMN IF EXISTS ecrs,
    DROP COLUMN IF EXISTS psc;

-- Verify columns are gone
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name IN ('fcl_rates', 'lcl_rates')
          AND column_name IN ('lss', 'baf', 'ecrs', 'psc')
    ) THEN
        RAISE EXCEPTION 'Migration 034 failed: flat surcharge columns still present';
    END IF;
END $$;
