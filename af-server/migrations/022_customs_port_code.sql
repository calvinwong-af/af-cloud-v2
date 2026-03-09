-- Migration 022: Replace country_code with port_code on customs_rates
-- Legacy customs charges (PricingCustomsCharges) were keyed by port_un_code + transaction_type + container_load.
-- The original customs_rates table used country_code which does not match legacy data structure.
-- This migration corrects the schema to align with legacy data for future migration fidelity.
--
-- NOTE: customs_rates table was created in migration 021 and is empty on prod at time of this migration.
-- Safe to drop and recreate constraints without data migration.

-- Step 1: Drop the old unique constraint
ALTER TABLE customs_rates DROP CONSTRAINT customs_rates_unique;

-- Step 2: Drop country_code column
ALTER TABLE customs_rates DROP COLUMN country_code;

-- Step 3: Add port_code column
ALTER TABLE customs_rates ADD COLUMN port_code VARCHAR(10) NOT NULL REFERENCES ports(un_code);

-- Step 4: Add new unique constraint
ALTER TABLE customs_rates ADD CONSTRAINT customs_rates_unique
    UNIQUE (port_code, trade_direction, shipment_type, charge_code, effective_from);
