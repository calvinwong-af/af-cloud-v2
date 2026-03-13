-- Migration 061: Remove scope_transport from shipment_details and
-- transport_details from quotations.
-- Area belongs on GT order stops (order_stops.area_id) only.
-- Quotations hold pricing calculations only — no operational data.

ALTER TABLE shipment_details
    DROP COLUMN IF EXISTS scope_transport;

ALTER TABLE quotations
    DROP COLUMN IF EXISTS transport_details;
