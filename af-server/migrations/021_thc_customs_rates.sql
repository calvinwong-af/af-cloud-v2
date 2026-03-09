-- Migration 021: THC (Terminal Handling Charges) and Customs Clearance rate tables
-- These are standardised rates with no supplier dimension (unlike fcl_rates / lcl_rates).
-- UOM values:
--   CONTAINER = per container (FCL)
--   CBM       = cubic metres (LCL)
--   KG        = gross weight kilograms (LCL/CB)
--   W/M       = weight or measurement / revenue tonne (LCL)
--   CW_KG     = chargeable weight kilograms (AIR) — distinct from gross KG
--   SET       = fixed set fee, default qty 1
--   BL        = per Bill of Lading
-- equipment_type on thc_rates is required for FCL rows (e.g. 20GP, 40HC, 40RF, 40FF),
-- NULL for LCL, AIR, CB rows where the distinction does not apply.

CREATE TABLE thc_rates (
    id               SERIAL PRIMARY KEY,
    port_code        VARCHAR(10)   NOT NULL REFERENCES ports(un_code),
    trade_direction  VARCHAR(10)   NOT NULL,
    shipment_type    VARCHAR(10)   NOT NULL,
    equipment_type   VARCHAR(10)   NULL,
    charge_code      VARCHAR(20)   NOT NULL,
    description      VARCHAR(255)  NOT NULL,
    amount           NUMERIC(12,2) NOT NULL,
    currency         VARCHAR(3)    NOT NULL DEFAULT 'MYR',
    uom              VARCHAR(20)   NOT NULL,
    effective_from   DATE          NOT NULL,
    effective_to     DATE          NULL,
    is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT thc_rates_direction_check CHECK (trade_direction IN ('IMPORT', 'EXPORT')),
    CONSTRAINT thc_rates_shipment_check  CHECK (shipment_type IN ('FCL', 'LCL', 'AIR', 'CB')),
    CONSTRAINT thc_rates_uom_check       CHECK (uom IN ('CONTAINER', 'CBM', 'KG', 'W/M', 'CW_KG', 'SET', 'BL')),
    CONSTRAINT thc_rates_unique          UNIQUE (port_code, trade_direction, shipment_type, equipment_type, charge_code, effective_from)
);

CREATE TABLE customs_rates (
    id               SERIAL PRIMARY KEY,
    country_code     VARCHAR(2)    NOT NULL REFERENCES countries(country_code),
    trade_direction  VARCHAR(10)   NOT NULL,
    shipment_type    VARCHAR(10)   NOT NULL,
    charge_code      VARCHAR(20)   NOT NULL,
    description      VARCHAR(255)  NOT NULL,
    amount           NUMERIC(12,2) NOT NULL,
    currency         VARCHAR(3)    NOT NULL DEFAULT 'MYR',
    uom              VARCHAR(20)   NOT NULL,
    effective_from   DATE          NOT NULL,
    effective_to     DATE          NULL,
    is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT customs_rates_direction_check CHECK (trade_direction IN ('IMPORT', 'EXPORT')),
    CONSTRAINT customs_rates_shipment_check  CHECK (shipment_type IN ('FCL', 'LCL', 'AIR', 'CB')),
    CONSTRAINT customs_rates_uom_check       CHECK (uom IN ('CONTAINER', 'CBM', 'KG', 'W/M', 'CW_KG', 'SET', 'BL')),
    CONSTRAINT customs_rates_unique          UNIQUE (country_code, trade_direction, shipment_type, charge_code, effective_from)
);
