-- Migration 043: Drop denormalized company_id from shipment_workflows
-- This column was seeded at record creation and never updated on company reassignment.
-- The only consumer (get_status_history AFC auth check) now JOINs orders instead.

ALTER TABLE shipment_workflows DROP COLUMN IF EXISTS company_id;
