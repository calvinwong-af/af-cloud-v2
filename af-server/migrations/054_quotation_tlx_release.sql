-- Migration 054: Add tlx_release flag to quotations
--
-- When TRUE, the LC-TLX (BL Surrender / Telex Release) local charge is
-- included in pricing for EXPORT direction. When FALSE (default), LC-TLX
-- is skipped even if a rate exists in local_charges.

ALTER TABLE quotations
    ADD COLUMN tlx_release BOOLEAN NOT NULL DEFAULT FALSE;
