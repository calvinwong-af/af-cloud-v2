-- Migration 038: Haulage Supplier Rebates
--
-- Creates the haulage_supplier_rebates table for tracking percentage-based
-- rebate agreements between AF and haulage suppliers.

-- ============================================================================
-- haulage_supplier_rebates
-- ============================================================================

-- Haulage supplier rebate agreements.
-- Malaysian FF agent model: hauliers give AF a percentage rebate off their stated cost,
-- applied per container moved. Rebate is cost-side only — never visible to the customer.
--
-- Rebate resolution: latest row by effective_from where effective_from <= reference_date.
-- Query pattern: WHERE supplier_id = X AND container_size = Y
--   AND effective_from <= ref_date ORDER BY effective_from DESC LIMIT 1
--
-- container_size side_loader_XX variants used when customer requests side-loader service.
-- supplier_id is a hard FK to companies(id) — a rebate without a verified supplier is invalid.
--
-- Effective cost formula:
--   effective_cost = haulage_rates.cost - (haulage_rates.cost * rebate_percent)

CREATE TABLE IF NOT EXISTS haulage_supplier_rebates (
    id              SERIAL PRIMARY KEY,
    supplier_id     VARCHAR(30) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    container_size  VARCHAR(20) NOT NULL,
    -- 20 | 40 | 40HC | side_loader_20 | side_loader_40 | side_loader_40HC
    effective_from  DATE NOT NULL,
    effective_to    DATE NULL,              -- NULL = open-ended
    rate_status     rate_status NOT NULL DEFAULT 'PUBLISHED',
    rebate_percent  NUMERIC(5,4) NOT NULL,  -- e.g. 0.0750 = 7.50%; no currency — percentage is currency-agnostic
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT haulage_supplier_rebates_container_size_check
        CHECK (container_size IN (
            '20', '40', '40HC',
            'side_loader_20', 'side_loader_40', 'side_loader_40HC'
        )),
    CONSTRAINT haulage_supplier_rebates_unique
        UNIQUE (supplier_id, container_size, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_haulage_supplier_rebates_supplier
    ON haulage_supplier_rebates (supplier_id);

CREATE INDEX IF NOT EXISTS idx_haulage_supplier_rebates_effective
    ON haulage_supplier_rebates (supplier_id, container_size, effective_from DESC);
