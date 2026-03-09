-- Migration 025: Replace customs_rates.amount with price + cost columns
-- The table was originally created with a single 'amount' column.
-- The frontend and backend already expect 'price' and 'cost' (matching local_charges pattern).
-- This migration aligns the prod schema.

ALTER TABLE customs_rates DROP CONSTRAINT customs_rates_uom_check;

ALTER TABLE customs_rates DROP COLUMN IF EXISTS amount;

ALTER TABLE customs_rates ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE customs_rates ADD COLUMN IF NOT EXISTS cost NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE customs_rates ADD CONSTRAINT customs_rates_uom_check
    CHECK (uom IN ('CONTAINER', 'CBM', 'KG', 'W/M', 'CW_KG', 'SET', 'BL'));
