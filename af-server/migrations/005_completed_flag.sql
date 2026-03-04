-- 005_completed_flag.sql
-- Add completed flag to shipments table.
-- Completion is now a business flag independent of physical status.
-- The status pipeline ends at 4002 Arrived; 5001 is legacy.

-- Add completed flag columns
ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill: any shipment at status 5001 → status 4002, completed = true
UPDATE shipments
SET status = 4002,
    completed = TRUE,
    completed_at = updated_at
WHERE status = 5001;

-- Index for list filtering performance
CREATE INDEX IF NOT EXISTS idx_shipments_completed ON shipments (completed);
