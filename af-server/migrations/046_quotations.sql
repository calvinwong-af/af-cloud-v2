-- Migration 046: Quotations table
-- Quotations are generated from shipment orders.
-- Each quotation captures a scope snapshot + transport details at time of creation.
-- Revisions are tracked as separate rows (revision integer increments per shipment).

-- Ensure update_updated_at trigger function exists (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS quotations (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_ref       VARCHAR(20)   NOT NULL UNIQUE,  -- e.g. AFQ-00000001
    shipment_id         VARCHAR(20)   NOT NULL REFERENCES orders(order_id) ON DELETE RESTRICT,
    status              VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',  -- DRAFT | SENT | ACCEPTED | REJECTED | EXPIRED
    revision            INTEGER       NOT NULL DEFAULT 1,
    scope_snapshot      JSONB         NOT NULL DEFAULT '{}',
    transport_details   JSONB         NOT NULL DEFAULT '[]',
    notes               TEXT          NULL,
    created_by          TEXT          NOT NULL,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotations_shipment ON quotations(shipment_id);
CREATE INDEX idx_quotations_status ON quotations(status);

-- Auto-update updated_at
CREATE TRIGGER trg_quotations_updated_at
    BEFORE UPDATE ON quotations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sequence for quotation_ref (zero-padded 8-digit)
CREATE SEQUENCE IF NOT EXISTS quotation_ref_seq START 1;
