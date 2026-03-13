-- Migration 051: Add is_international flag to local_charges and dg_class_charges

-- Add is_international flag to local_charges
ALTER TABLE local_charges
  ADD COLUMN is_international BOOLEAN NOT NULL DEFAULT TRUE;

-- Add is_international flag to dg_class_charges
ALTER TABLE dg_class_charges
  ADD COLUMN is_international BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill: rows that are domestic-only should NOT apply to international
UPDATE local_charges SET is_international = FALSE WHERE is_domestic = TRUE;
UPDATE dg_class_charges SET is_international = FALSE WHERE is_domestic = TRUE;
