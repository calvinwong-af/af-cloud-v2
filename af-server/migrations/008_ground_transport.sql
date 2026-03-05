-- Migration 008: Ground transport tables + shipments.scope column

CREATE TABLE IF NOT EXISTS ground_transport_orders (
    transport_order_id  VARCHAR(20)   PRIMARY KEY,
    transport_type      VARCHAR(20)   NOT NULL,
    leg_type            VARCHAR(20)   NOT NULL,
    parent_shipment_id  VARCHAR(30)   NULL,
    vendor_id           VARCHAR(30)   NULL,
    status              VARCHAR(30)   NOT NULL DEFAULT 'draft',

    cargo_description   TEXT          NULL,
    container_numbers   JSONB         NOT NULL DEFAULT '[]',
    weight_kg           NUMERIC(10,2) NULL,
    volume_cbm          NUMERIC(10,2) NULL,

    driver_name         VARCHAR(100)  NULL,
    driver_contact      VARCHAR(50)   NULL,
    vehicle_plate       VARCHAR(30)   NULL,
    equipment_type      VARCHAR(100)  NULL,

    equipment_number    VARCHAR(50)   NULL,
    detention_mode      VARCHAR(20)   NULL,
    detention_free_days INTEGER       NULL,
    container_yard_id   INTEGER       NULL REFERENCES cities(city_id),

    notes               TEXT          NULL,
    created_by          VARCHAR(100)  NULL,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ground_transport_legs (
    leg_id                  SERIAL        PRIMARY KEY,
    transport_order_id      VARCHAR(20)   NOT NULL REFERENCES ground_transport_orders(transport_order_id) ON DELETE CASCADE,
    leg_sequence            INTEGER       NOT NULL,
    leg_type                VARCHAR(20)   NOT NULL,

    origin_city_id          INTEGER       NULL REFERENCES cities(city_id),
    origin_haulage_area_id  INTEGER       NULL REFERENCES haulage_areas(area_id),
    origin_address_line     TEXT          NULL,
    origin_lat              NUMERIC(9,6)  NULL,
    origin_lng              NUMERIC(9,6)  NULL,

    dest_city_id            INTEGER       NULL REFERENCES cities(city_id),
    dest_haulage_area_id    INTEGER       NULL REFERENCES haulage_areas(area_id),
    dest_address_line       TEXT          NULL,
    dest_lat                NUMERIC(9,6)  NULL,
    dest_lng                NUMERIC(9,6)  NULL,

    scheduled_date          DATE          NULL,
    actual_date             DATE          NULL,
    status                  VARCHAR(20)   NOT NULL DEFAULT 'pending',

    notes                   TEXT          NULL,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    UNIQUE (transport_order_id, leg_sequence)
);

ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS scope JSONB NOT NULL DEFAULT '{
        "first_mile_haulage": false,
        "first_mile_trucking": false,
        "export_clearance": false,
        "sea_freight": true,
        "import_clearance": false,
        "last_mile_haulage": false,
        "last_mile_trucking": false
    }';

CREATE INDEX IF NOT EXISTS idx_gt_orders_parent_shipment ON ground_transport_orders(parent_shipment_id) WHERE parent_shipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gt_orders_status ON ground_transport_orders(status);
CREATE INDEX IF NOT EXISTS idx_gt_orders_type ON ground_transport_orders(transport_type);
CREATE INDEX IF NOT EXISTS idx_gt_legs_order ON ground_transport_legs(transport_order_id);
