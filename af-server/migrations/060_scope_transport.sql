-- Migration 060: Add scope_transport to shipment_details
-- Stores transport detail defaults (area_id, vehicle_type_id per leg) at the
-- shipment level, independent of any quotation. Quotation creation inherits
-- these values as initial transport_details.

ALTER TABLE shipment_details
    ADD COLUMN IF NOT EXISTS scope_transport JSONB NOT NULL DEFAULT '{}';
