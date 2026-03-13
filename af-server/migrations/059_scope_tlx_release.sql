-- Migration 059: Move tlx_release from quotations to shipment_details
-- tlx_release controls whether LC-TLX (BL Surrender / Telex Release) local
-- charge is included in pricing. It belongs on the shipment, not the quotation.

-- 1. Add tlx_release column to shipment_details
ALTER TABLE shipment_details
    ADD COLUMN IF NOT EXISTS tlx_release BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Backfill: for any quotation with tlx_release=TRUE, propagate to the shipment
UPDATE shipment_details sd
SET tlx_release = TRUE
FROM quotations q
WHERE q.shipment_id = sd.order_id
  AND q.tlx_release = TRUE;

-- 3. Drop tlx_release from quotations
ALTER TABLE quotations
    DROP COLUMN IF EXISTS tlx_release;
