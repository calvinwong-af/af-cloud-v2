-- Migration 048: Quotation line items + currency on quotations
--
-- Adds:
--   1. currency column to quotations (resolved from company's assigned currency)
--   2. scope_changed flag on quotations (set when scope changes after initial calculation)
--   3. quotation_line_items table — one row per charge component per quotation
--
-- Effective price/cost are computed at read time (never stored):
--   effective_price = MAX(quantity * price_per_unit, min_price)
--   effective_cost  = MAX(quantity * cost_per_unit,  min_cost)
--   margin          = (effective_price - effective_cost_converted) / effective_price

-- ---------------------------------------------------------------------------
-- 1. Extend quotations table
-- ---------------------------------------------------------------------------

ALTER TABLE quotations
    ADD COLUMN currency      VARCHAR(3)  NOT NULL DEFAULT 'MYR',
    ADD COLUMN scope_changed BOOLEAN     NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 2. quotation_line_items
-- ---------------------------------------------------------------------------

CREATE TABLE quotation_line_items (
    id                  SERIAL          PRIMARY KEY,
    quotation_id        UUID            NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,

    -- Component classification
    component_type      VARCHAR(40)     NOT NULL,
    -- Valid values:
    --   ocean_freight | air_freight
    --   export_local  | import_local
    --   export_customs | import_customs
    --   export_haulage | import_haulage
    --   export_transport | import_transport
    --   insurance | other

    charge_code         VARCHAR(20)     NOT NULL,
    -- e.g. FR-LSS, HA-RAT, CUS-FWD, IN-PRE, OT-STR

    description         VARCHAR(255)    NOT NULL,
    uom                 VARCHAR(20)     NOT NULL,
    quantity            NUMERIC(12, 4)  NOT NULL DEFAULT 0,

    -- Price (customer-facing, stored in price_currency)
    price_per_unit      NUMERIC(12, 4)  NOT NULL DEFAULT 0,
    min_price           NUMERIC(12, 4)  NOT NULL DEFAULT 0,
    price_currency      VARCHAR(3)      NOT NULL,
    price_conversion    NUMERIC(14, 6)  NOT NULL DEFAULT 1,
    -- Conversion factor applied at calculation time: price_currency → quotation currency

    -- Cost (AF-facing, stored in cost_currency)
    cost_per_unit       NUMERIC(12, 4)  NOT NULL DEFAULT 0,
    min_cost            NUMERIC(12, 4)  NOT NULL DEFAULT 0,
    cost_currency       VARCHAR(3)      NOT NULL,
    cost_conversion     NUMERIC(14, 6)  NOT NULL DEFAULT 1,
    -- Conversion factor applied at calculation time: cost_currency → quotation currency

    -- Source traceability (soft reference — no FK enforced)
    source_table        VARCHAR(60)     NULL,
    -- e.g. 'fcl_rates', 'lcl_rates', 'air_freight_rates',
    --      'haulage_rates', 'port_transport_rates',
    --      'local_charges', 'customs_rates'
    source_rate_id      INTEGER         NULL,
    -- Row ID in the source table at time of calculation

    -- Manual override — rows with TRUE are skipped on recalculate
    is_manual_override  BOOLEAN         NOT NULL DEFAULT FALSE,

    sort_order          INTEGER         NOT NULL DEFAULT 0,

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qli_quotation_id ON quotation_line_items(quotation_id);
CREATE INDEX idx_qli_component_type ON quotation_line_items(quotation_id, component_type);

CREATE TRIGGER trg_qli_updated_at
    BEFORE UPDATE ON quotation_line_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
