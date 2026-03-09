-- Migration 023: Unify port-level charges into local_charges
-- Drops thc_rates (empty on prod). Updates customs_rates. Creates local_charges.

DROP TABLE IF EXISTS thc_rates;

ALTER TABLE customs_rates RENAME COLUMN amount TO price;
ALTER TABLE customs_rates ADD COLUMN cost NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE customs_rates ADD COLUMN is_domestic BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE customs_rates DROP CONSTRAINT customs_rates_shipment_check;
ALTER TABLE customs_rates ADD CONSTRAINT customs_rates_shipment_check
    CHECK (shipment_type IN ('FCL', 'LCL', 'AIR', 'CB', 'ALL'));
ALTER TABLE customs_rates DROP CONSTRAINT customs_rates_unique;
ALTER TABLE customs_rates ADD CONSTRAINT customs_rates_unique
    UNIQUE (port_code, trade_direction, shipment_type, charge_code, is_domestic, effective_from);

CREATE TABLE local_charges (
    id                SERIAL PRIMARY KEY,
    port_code         VARCHAR(10)   NOT NULL REFERENCES ports(un_code),
    trade_direction   VARCHAR(10)   NOT NULL,
    shipment_type     VARCHAR(10)   NOT NULL DEFAULT 'ALL',
    container_size    VARCHAR(10)   NOT NULL DEFAULT 'ALL',
    container_type    VARCHAR(10)   NOT NULL DEFAULT 'ALL',
    charge_code       VARCHAR(20)   NOT NULL,
    description       VARCHAR(255)  NOT NULL,
    price             NUMERIC(12,2) NOT NULL,
    cost              NUMERIC(12,2) NOT NULL,
    currency          VARCHAR(3)    NOT NULL DEFAULT 'MYR',
    uom               VARCHAR(20)   NOT NULL,
    is_domestic       BOOLEAN       NOT NULL DEFAULT FALSE,
    paid_with_freight BOOLEAN       NOT NULL DEFAULT FALSE,
    effective_from    DATE          NOT NULL,
    effective_to      DATE          NULL,
    is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT lc_direction_check      CHECK (trade_direction IN ('IMPORT', 'EXPORT')),
    CONSTRAINT lc_shipment_check       CHECK (shipment_type IN ('FCL', 'LCL', 'AIR', 'CB', 'ALL')),
    CONSTRAINT lc_container_size_check CHECK (container_size IN ('20', '40', 'ALL')),
    CONSTRAINT lc_container_type_check CHECK (container_type IN ('GP', 'HC', 'RF', 'FF', 'OT', 'FR', 'PL', 'ALL')),
    CONSTRAINT lc_uom_check            CHECK (uom IN ('CONTAINER', 'CBM', 'KG', 'W/M', 'CW_KG', 'SET', 'BL')),
    CONSTRAINT lc_unique               UNIQUE (port_code, trade_direction, shipment_type, container_size, container_type, charge_code, is_domestic, effective_from)
);
