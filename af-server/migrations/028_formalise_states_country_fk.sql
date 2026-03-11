-- Migration 028: Formalise states.country_code FK to countries
-- Drops the legacy DEFAULT 'MY', adds FK constraint with ON UPDATE CASCADE.
-- Prerequisite for migration 029 (areas restructure with state_code NOT NULL).

-- Step 1: Abort if any states rows reference a country_code not in countries
DO $$
DECLARE
    dirty_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dirty_count
    FROM states
    WHERE country_code NOT IN (SELECT country_code FROM countries);

    IF dirty_count > 0 THEN
        RAISE EXCEPTION
            'Migration aborted: % state row(s) have country_code not present in countries table.',
            dirty_count;
    END IF;
END $$;

-- Step 2: Drop the legacy DEFAULT 'MY' — all inserts must now specify country explicitly
ALTER TABLE states ALTER COLUMN country_code DROP DEFAULT;

-- Step 3: Add FK constraint to countries table
ALTER TABLE states
    ADD CONSTRAINT fk_states_country_code
    FOREIGN KEY (country_code)
    REFERENCES countries(country_code)
    ON UPDATE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

-- Step 4: Add column comment
COMMENT ON COLUMN states.country_code IS
    'ISO 3166-1 alpha-2 country code. FK to countries. '
    'For city-states (SG, HK, MO etc.) a single state record representing '
    'the territory itself is used — state_code mirrors country_code.';
