-- Migration 049: Add dg_class_code dimension to local_charges
-- Allows DG-specific THC rates (e.g. DG-2, DG-3) to coexist with NON-DG rates.
-- Backfill: LC-THC rows -> 'NON-DG' (existing data is non-DG); all others -> 'ALL'.

ALTER TABLE local_charges
    ADD COLUMN dg_class_code VARCHAR(10) NOT NULL DEFAULT 'NON-DG';

ALTER TABLE local_charges
    ADD CONSTRAINT lc_dg_class_check
    CHECK (dg_class_code IN ('NON-DG', 'DG-2', 'DG-3', 'ALL'));

-- Backfill: non-THC charges apply to all shipment DG statuses
UPDATE local_charges
SET dg_class_code = 'ALL'
WHERE charge_code != 'LC-THC';

-- THC rows stay as 'NON-DG' (the DEFAULT already set them correctly)
-- No UPDATE needed for LC-THC rows.

-- Drop and recreate unique constraint to include dg_class_code
ALTER TABLE local_charges DROP CONSTRAINT lc_unique;

ALTER TABLE local_charges
    ADD CONSTRAINT lc_unique
    UNIQUE (port_code, trade_direction, shipment_type, container_size, container_type,
            charge_code, is_domestic, dg_class_code, effective_from);
