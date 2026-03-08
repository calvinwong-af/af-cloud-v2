-- Migration 017: Add effective_to to fcl_rates and lcl_rates
-- Nullable — existing rates are open-ended (no end date)

ALTER TABLE fcl_rates ADD COLUMN IF NOT EXISTS effective_to DATE NULL;
ALTER TABLE lcl_rates ADD COLUMN IF NOT EXISTS effective_to DATE NULL;
