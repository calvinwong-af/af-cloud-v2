-- Migration 010: Rename haulage_areas to areas
-- Renames the table and all column references from haulage_area_id to area_id

-- Rename the table
ALTER TABLE haulage_areas RENAME TO areas;

-- Rename the primary key column
ALTER TABLE areas RENAME COLUMN haulage_area_id TO area_id;

-- Update FK references in ground_transport_legs
ALTER TABLE ground_transport_legs
  RENAME COLUMN origin_haulage_area_id TO origin_area_id;
ALTER TABLE ground_transport_legs
  RENAME COLUMN dest_haulage_area_id TO dest_area_id;

-- Rename indexes if they exist
ALTER INDEX IF EXISTS haulage_areas_pkey RENAME TO areas_pkey;
