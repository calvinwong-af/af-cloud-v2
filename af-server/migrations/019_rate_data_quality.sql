-- Migration 019: Rate data quality fixes
--
-- 1. Fix inverted effective dates (effective_from > effective_to)
--    These are data entry errors where end date precedes start date.
--    Resolution: clear effective_to (make open-ended) since the intent
--    was clearly to create an ongoing rate.
--
-- NOTE: Part 2 (terminate superseded open-ended records) was attempted and
-- rolled back. The time series builder handles overlapping open-ended records
-- correctly in code — data should not be modified to work around this.
-- The rollback SQL (clearing effective_to where migration-set terminations
-- matched the pattern effective_to + 1 day = next effective_from) was run
-- on 2026-03-09. Prod DB does not have this migration applied.

UPDATE fcl_rates
SET effective_to = NULL
WHERE effective_to IS NOT NULL
  AND effective_to < effective_from;

UPDATE lcl_rates
SET effective_to = NULL
WHERE effective_to IS NOT NULL
  AND effective_to < effective_from;
