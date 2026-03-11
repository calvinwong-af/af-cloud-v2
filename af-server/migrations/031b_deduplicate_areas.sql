-- Migration 031b: Deduplicate area_code values before unique constraint can be applied
-- The old composite unique (area_code, port_un_code) allowed the same area_code
-- to exist multiple times with different port_un_code values.
-- Migration 031 will enforce UNIQUE (area_code) — duplicates must be removed first.
-- Strategy: keep the row with the lowest area_id (earliest seeded); delete the rest.
-- port_un_code is being dropped entirely in 031, so no data is lost.

DELETE FROM areas
WHERE area_id NOT IN (
    SELECT MIN(area_id)
    FROM areas
    GROUP BY area_code
);

-- Verify: no duplicate area_codes remain
DO $$
DECLARE dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dup_count
    FROM (
        SELECT area_code FROM areas GROUP BY area_code HAVING COUNT(*) > 1
    ) dups;

    IF dup_count > 0 THEN
        RAISE EXCEPTION
            'Migration 031b incomplete: % area_code(s) still have duplicates.',
            dup_count;
    END IF;
    RAISE NOTICE 'Migration 031b complete — all area_codes are unique. Ready for 031.';
END $$;
