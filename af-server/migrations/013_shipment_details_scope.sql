-- Migration 013: Add scope column to shipment_details
-- The scope JSONB was mistakenly omitted from shipment_details in migration 011.
-- The scope router reads/writes shipment_details.scope, not orders.scope.

ALTER TABLE shipment_details ADD COLUMN IF NOT EXISTS scope JSONB;
