-- Migration 052: Tax rules table
--
-- Stores country-level tax rules applied during quotation pricing.
-- Each rule defines a tax code, rate, and the component_types it applies to.
-- The pricing engine resolves tax at calculation time and stamps tax_rate
-- onto each eligible line item.

CREATE TABLE tax_rules (
    id              SERIAL          PRIMARY KEY,
    country_code    VARCHAR(2)      NOT NULL,
    tax_code        VARCHAR(20)     NOT NULL,
    tax_name        VARCHAR(100)    NOT NULL,
    rate            NUMERIC(5,4)    NOT NULL,
    applies_to      TEXT[]          NOT NULL,
    effective_from  DATE            NOT NULL,
    effective_to    DATE            NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tax_rules_country ON tax_rules(country_code);
CREATE INDEX idx_tax_rules_active ON tax_rules(is_active, effective_from);

CREATE TRIGGER trg_tax_rules_updated_at
    BEFORE UPDATE ON tax_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed: Malaysian SST (Logistics Services Tax)
-- Applies to all local operations. Does NOT apply to international freight
-- (ocean_freight, air_freight) — those are excluded from applies_to entirely.
INSERT INTO tax_rules (country_code, tax_code, tax_name, rate, applies_to, effective_from)
VALUES (
    'MY',
    'MY-SST',
    'Malaysian SST (Logistics)',
    0.0600,
    ARRAY[
        'export_local', 'import_local',
        'export_customs', 'import_customs',
        'export_haulage', 'import_haulage',
        'export_transport', 'import_transport',
        'export_dg', 'import_dg',
        'other'
    ],
    '2024-01-01'
);
