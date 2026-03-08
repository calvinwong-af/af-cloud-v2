-- Migration 016: Extend rate_status enum with DRAFT and REJECTED
-- NOTE: PostgreSQL ALTER TYPE ADD VALUE cannot run inside a transaction block.
-- Run this migration outside of BEGIN/COMMIT.

ALTER TYPE rate_status ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE rate_status ADD VALUE IF NOT EXISTS 'REJECTED';
