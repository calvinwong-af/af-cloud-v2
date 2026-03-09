-- Migration 024: Add QTL and RAIL_3KG to local_charges uom check constraint
-- These UOMs are required for legacy data migration and ongoing EU freight use.

ALTER TABLE local_charges DROP CONSTRAINT lc_uom_check;

ALTER TABLE local_charges ADD CONSTRAINT lc_uom_check
    CHECK (uom IN ('CONTAINER', 'CBM', 'KG', 'W/M', 'CW_KG', 'SET', 'BL', 'QTL', 'RAIL_3KG'));
