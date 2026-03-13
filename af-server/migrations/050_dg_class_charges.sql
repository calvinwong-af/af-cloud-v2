-- Migration 050: Create dg_class_charges table
-- Stores DG-specific port-level charges (inspection, documentation, hazmat handling).
-- Separate from local_charges — always requires exact dg_class_code match (no ALL wildcard).

CREATE TABLE dg_class_charges (
    id                SERIAL PRIMARY KEY,
    port_code         VARCHAR(10)   NOT NULL REFERENCES ports(un_code) ON DELETE RESTRICT,
    trade_direction   VARCHAR(10)   NOT NULL,
    shipment_type     VARCHAR(10)   NOT NULL DEFAULT 'ALL',
    dg_class_code     VARCHAR(10)   NOT NULL,
    container_size    VARCHAR(10)   NOT NULL DEFAULT 'ALL',
    container_type    VARCHAR(10)   NOT NULL DEFAULT 'ALL',
    charge_code       VARCHAR(20)   NOT NULL,
    description       VARCHAR(255)  NOT NULL,
    price             NUMERIC(12,2) NOT NULL,
    cost              NUMERIC(12,2) NOT NULL,
    currency          VARCHAR(3)    NOT NULL DEFAULT 'MYR',
    uom               VARCHAR(20)   NOT NULL,
    is_domestic       BOOLEAN       NOT NULL DEFAULT FALSE,
    effective_from    DATE          NOT NULL,
    effective_to      DATE          NULL,
    is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT dgc_direction_check      CHECK (trade_direction IN ('IMPORT', 'EXPORT')),
    CONSTRAINT dgc_shipment_check       CHECK (shipment_type IN ('FCL', 'LCL', 'AIR', 'CB', 'ALL')),
    CONSTRAINT dgc_dg_class_check       CHECK (dg_class_code IN ('DG-2', 'DG-3')),
    CONSTRAINT dgc_container_size_check CHECK (container_size IN ('20', '40', 'ALL')),
    CONSTRAINT dgc_container_type_check CHECK (container_type IN ('GP', 'HC', 'RF', 'FF', 'OT', 'FR', 'PL', 'ALL')),
    CONSTRAINT dgc_uom_check            CHECK (uom IN ('CONTAINER', 'CBM', 'KG', 'W/M', 'SET', 'BL')),
    CONSTRAINT dgc_unique               UNIQUE (port_code, trade_direction, shipment_type,
                                                dg_class_code, container_size, container_type,
                                                charge_code, is_domestic, effective_from)
);

CREATE INDEX idx_dg_class_charges_port ON dg_class_charges (port_code, trade_direction);
CREATE INDEX idx_dg_class_charges_active ON dg_class_charges (is_active, effective_from);
