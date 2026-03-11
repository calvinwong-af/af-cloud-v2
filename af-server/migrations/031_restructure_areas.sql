-- Migration 029: Restructure areas table
-- Removes legacy port_un_code and city_id columns, enforces state_code NOT NULL,
-- replaces composite unique (area_code, port_un_code) with single-column unique (area_code),
-- adds named FK constraint to states.

-- Step 1: Abort if any areas rows have NULL state_code
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count
    FROM areas
    WHERE state_code IS NULL;

    IF null_count > 0 THEN
        RAISE EXCEPTION
            'Migration aborted: % area row(s) have NULL state_code. '
            'All areas must have a valid state parent before enforcing NOT NULL.',
            null_count;
    END IF;
END $$;

-- Step 2: Abort if any areas rows have a state_code not present in states
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM areas
    WHERE state_code NOT IN (SELECT state_code FROM states);

    IF orphan_count > 0 THEN
        RAISE EXCEPTION
            'Migration aborted: % area row(s) have state_code not present in states table.',
            orphan_count;
    END IF;
END $$;

-- Step 3: Drop the composite unique constraint (area_code, port_un_code)
DO $$
BEGIN
    -- Try original auto-generated name first
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'haulage_areas_area_code_port_un_code_key'
    ) THEN
        ALTER TABLE areas
            DROP CONSTRAINT haulage_areas_area_code_port_un_code_key;

    -- Try renamed variant if migration 010 renamed it
    ELSIF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'areas_area_code_port_un_code_key'
    ) THEN
        ALTER TABLE areas
            DROP CONSTRAINT areas_area_code_port_un_code_key;
    ELSE
        RAISE NOTICE 'Composite unique constraint not found — may already have been dropped.';
    END IF;
END $$;

-- Step 4: Drop port_un_code column
ALTER TABLE areas DROP COLUMN IF EXISTS port_un_code;

-- Step 5: Drop city_id column
ALTER TABLE areas DROP COLUMN IF EXISTS city_id;

-- Step 6: Enforce state_code NOT NULL
ALTER TABLE areas ALTER COLUMN state_code SET NOT NULL;

-- Step 7: Add new single-column unique constraint
ALTER TABLE areas ADD CONSTRAINT areas_area_code_key UNIQUE (area_code);

-- Step 8: Add FK constraint state_code → states
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_areas_state_code'
    ) THEN
        ALTER TABLE areas
            ADD CONSTRAINT fk_areas_state_code
            FOREIGN KEY (state_code)
            REFERENCES states(state_code)
            ON UPDATE CASCADE
            DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;
