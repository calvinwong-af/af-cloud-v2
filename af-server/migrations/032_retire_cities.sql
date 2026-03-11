-- Migration 032 — Retire cities table
-- cities was a loose reference layer never used as source of truth.
-- city_id on order_stops is always NULL in practice; areas + address_line are the stop location model.

BEGIN;

-- Step 1: Drop city_id from order_stops (IF EXISTS for safety)
ALTER TABLE order_stops DROP COLUMN IF EXISTS city_id;

-- Step 2: Drop cities table (CASCADE to handle any remaining FK references)
DROP TABLE IF EXISTS cities CASCADE;

-- Verification
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order_stops' AND column_name = 'city_id'
    ) THEN
        RAISE EXCEPTION 'MIGRATION FAILED: city_id still exists on order_stops';
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'cities'
    ) THEN
        RAISE EXCEPTION 'MIGRATION FAILED: cities table still exists';
    END IF;
    RAISE NOTICE 'Migration 032 verified OK — cities table retired, city_id dropped from order_stops';
END $$;

COMMIT;
