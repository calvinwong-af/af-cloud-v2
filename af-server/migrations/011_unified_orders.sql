-- Migration 011: Unified orders architecture
-- Merges shipments + ground_transport_orders into a unified orders table
-- Creates shipment_details, order_stops, order_legs tables
-- Preserves old tables as _legacy backups

-- =========================================================================
-- 1. Create orders table
-- =========================================================================
CREATE TABLE orders (
    order_id            VARCHAR(20) PRIMARY KEY,
    order_type          VARCHAR(20) NOT NULL,        -- "shipment" | "transport"
    transport_mode      VARCHAR(20),                  -- null | "trucking" | "haulage"
    status              VARCHAR(30) NOT NULL DEFAULT 'draft',
    sub_status          VARCHAR(50),
    company_id          VARCHAR(100),
    cargo               JSONB,
    parties             JSONB,
    scope               JSONB,
    parent_order_id     VARCHAR(20),                  -- FK added after data migration
    completed           BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at        TIMESTAMPTZ,
    issued_invoice      BOOLEAN NOT NULL DEFAULT FALSE,
    created_by          VARCHAR(200),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    migrated_from_v1    BOOLEAN NOT NULL DEFAULT FALSE,
    trash               BOOLEAN NOT NULL DEFAULT FALSE,
    countid             BIGINT,
    -- Transport-specific (nullable for shipments)
    leg_type            VARCHAR(20),
    detention_mode      VARCHAR(20),
    detention_free_days INTEGER,
    vendor_id           VARCHAR(100),
    notes               TEXT
);

-- =========================================================================
-- 2. Create shipment_details table
-- =========================================================================
CREATE TABLE shipment_details (
    order_id            VARCHAR(20) PRIMARY KEY REFERENCES orders(order_id),
    incoterm_code       VARCHAR(10),
    transaction_type    VARCHAR(10),                  -- "export" | "import"
    order_type_detail   VARCHAR(20),                  -- "SEA_FCL" | "SEA_LCL" | "AIR"
    origin_port         VARCHAR(10),
    dest_port           VARCHAR(10),
    origin_terminal     VARCHAR(100),
    dest_terminal       VARCHAR(100),
    booking             JSONB,
    bl_document         JSONB,
    route_nodes         JSONB,
    type_details        JSONB,
    exception_data      JSONB,
    status_history      JSONB NOT NULL DEFAULT '[]'::jsonb,
    mawb_number         VARCHAR(50),
    hawb_number         VARCHAR(50),
    awb_type            VARCHAR(20),
    -- Additional fields from shipments not in prompt but needed for continuity
    cargo_ready_date    DATE,
    etd                 TIMESTAMPTZ,
    eta                 TIMESTAMPTZ
);

-- =========================================================================
-- 3. Create order_stops table
-- =========================================================================
CREATE TABLE order_stops (
    stop_id             SERIAL PRIMARY KEY,
    order_id            VARCHAR(20) NOT NULL REFERENCES orders(order_id),
    sequence            INTEGER NOT NULL,
    stop_type           VARCHAR(20) NOT NULL,         -- "pickup" | "dropoff" | "waypoint"
    address_line        TEXT,
    area_id             INTEGER REFERENCES areas(area_id),
    city_id             INTEGER REFERENCES cities(city_id),
    lat                 NUMERIC(10, 7),
    lng                 NUMERIC(10, 7),
    scheduled_arrival   DATE,
    actual_arrival      DATE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(order_id, sequence)
);

-- =========================================================================
-- 4. Create order_legs table (auto-derived from stops)
-- =========================================================================
CREATE TABLE order_legs (
    leg_id              SERIAL PRIMARY KEY,
    order_id            VARCHAR(20) NOT NULL REFERENCES orders(order_id),
    from_stop_id        INTEGER NOT NULL REFERENCES order_stops(stop_id),
    to_stop_id          INTEGER NOT NULL REFERENCES order_stops(stop_id),
    sequence            INTEGER NOT NULL,
    driver_name         VARCHAR(200),
    driver_contact      VARCHAR(100),
    vehicle_plate       VARCHAR(50),
    vehicle_type_id     VARCHAR(50) REFERENCES vehicle_types(vehicle_type_id),
    equipment_type      VARCHAR(100),
    equipment_number    VARCHAR(100),
    status              VARCHAR(30) NOT NULL DEFAULT 'pending',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(order_id, sequence)
);

-- =========================================================================
-- 5. Migrate shipments -> orders + shipment_details
-- =========================================================================
INSERT INTO orders (
    order_id, order_type, status, sub_status, company_id,
    cargo, parties, scope, completed, completed_at,
    issued_invoice, created_by, created_at, updated_at,
    migrated_from_v1, trash, countid
)
SELECT
    id,
    'shipment',
    CASE
        WHEN status = -1    THEN 'cancelled'
        WHEN status = 5001  THEN 'completed'
        WHEN status IN (1001, 1002) THEN 'draft'
        WHEN status IN (2001) THEN 'confirmed'
        ELSE 'in_progress'
    END,
    CASE
        WHEN status = 2001  THEN 'confirmed'
        WHEN status = 3001  THEN 'booking_pending'
        WHEN status = 3002  THEN 'booking_confirmed'
        WHEN status = 4001  THEN 'in_transit'
        WHEN status = 4002  THEN 'arrived'
        WHEN status = 5001  THEN NULL
        WHEN status = -1    THEN NULL
        ELSE NULL
    END,
    company_id,
    cargo, parties, scope,
    COALESCE(completed, FALSE), completed_at,
    COALESCE(issued_invoice, FALSE),
    creator->>'email',
    created_at, updated_at,
    COALESCE(migrated_from_v1, FALSE),
    COALESCE(trash, FALSE),
    countid
FROM shipments;

INSERT INTO shipment_details (
    order_id, incoterm_code, transaction_type, order_type_detail,
    origin_port, dest_port, origin_terminal, dest_terminal,
    booking, bl_document, route_nodes, type_details,
    exception_data, status_history,
    cargo_ready_date, etd, eta
)
SELECT
    id,
    incoterm_code,
    transaction_type,
    order_type,
    origin_port, dest_port,
    origin_terminal, dest_terminal,
    booking, bl_document, route_nodes, type_details,
    exception_data, status_history,
    cargo_ready_date, etd, eta
FROM shipments;

-- =========================================================================
-- 6. Migrate ground_transport_orders -> orders
-- =========================================================================
INSERT INTO orders (
    order_id, order_type, transport_mode, status,
    company_id, cargo, parent_order_id,
    leg_type, detention_mode, detention_free_days, vendor_id, notes,
    created_by, created_at, updated_at, trash
)
SELECT
    transport_order_id,
    'transport',
    transport_type,
    CASE
        WHEN status = 'cancelled'  THEN 'cancelled'
        WHEN status = 'completed'  THEN 'completed'
        WHEN status = 'draft'      THEN 'draft'
        WHEN status = 'confirmed'  THEN 'confirmed'
        ELSE 'in_progress'
    END,
    NULL,
    jsonb_build_object(
        'description', cargo_description,
        'container_numbers', container_numbers,
        'weight_kg', weight_kg,
        'volume_cbm', volume_cbm
    ),
    parent_shipment_id,
    leg_type,
    detention_mode,
    detention_free_days,
    vendor_id,
    notes,
    created_by, created_at, updated_at, FALSE
FROM ground_transport_orders;

-- Now add parent_order_id FK (after data is inserted)
ALTER TABLE orders ADD CONSTRAINT fk_orders_parent
    FOREIGN KEY (parent_order_id) REFERENCES orders(order_id);

-- =========================================================================
-- 7. Migrate ground_transport_legs -> order_stops + order_legs
-- =========================================================================

-- Insert origin stops (odd sequences)
INSERT INTO order_stops (
    order_id, sequence, stop_type,
    address_line, area_id, city_id, lat, lng, scheduled_arrival
)
SELECT
    transport_order_id,
    (leg_sequence * 2) - 1,
    'pickup',
    origin_address_line,
    origin_area_id,
    origin_city_id,
    origin_lat, origin_lng,
    scheduled_date
FROM ground_transport_legs;

-- Insert destination stops (even sequences)
INSERT INTO order_stops (
    order_id, sequence, stop_type,
    address_line, area_id, city_id, lat, lng, actual_arrival
)
SELECT
    transport_order_id,
    (leg_sequence * 2),
    'dropoff',
    dest_address_line,
    dest_area_id,
    dest_city_id,
    dest_lat, dest_lng,
    actual_date
FROM ground_transport_legs;

-- Derive order_legs from stop pairs
INSERT INTO order_legs (
    order_id, from_stop_id, to_stop_id, sequence,
    driver_name, driver_contact, vehicle_plate,
    vehicle_type_id, equipment_type, equipment_number, status
)
SELECT
    os_from.order_id,
    os_from.stop_id,
    os_to.stop_id,
    gll.leg_sequence,
    gto.driver_name,
    gto.driver_contact,
    gto.vehicle_plate,
    gto.vehicle_type_id,
    gto.equipment_type,
    gto.equipment_number,
    gll.status
FROM ground_transport_legs gll
JOIN order_stops os_from
    ON os_from.order_id = gll.transport_order_id
    AND os_from.sequence = (gll.leg_sequence * 2) - 1
JOIN order_stops os_to
    ON os_to.order_id = gll.transport_order_id
    AND os_to.sequence = (gll.leg_sequence * 2)
JOIN ground_transport_orders gto
    ON gto.transport_order_id = gll.transport_order_id;

-- =========================================================================
-- 8. Update shipment_workflows FK to reference orders
-- =========================================================================
ALTER TABLE shipment_workflows DROP CONSTRAINT IF EXISTS shipment_workflows_shipment_id_fkey;
ALTER TABLE shipment_workflows RENAME COLUMN shipment_id TO order_id;
ALTER TABLE shipment_workflows ADD CONSTRAINT shipment_workflows_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE;

-- =========================================================================
-- 9. Update shipment_files FK to reference orders
-- =========================================================================
ALTER TABLE shipment_files DROP CONSTRAINT IF EXISTS shipment_files_shipment_id_fkey;
ALTER TABLE shipment_files RENAME COLUMN shipment_id TO order_id;
ALTER TABLE shipment_files ADD CONSTRAINT shipment_files_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE;

-- =========================================================================
-- 10. Update sequences
-- =========================================================================
SELECT setval('shipment_countid_seq', GREATEST(
    (SELECT COALESCE(MAX(countid), 730) FROM orders WHERE countid IS NOT NULL),
    730
));

-- =========================================================================
-- 11. Indexes
-- =========================================================================
CREATE INDEX idx_orders_company_id ON orders(company_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_type ON orders(order_type);
CREATE INDEX idx_orders_parent_order_id ON orders(parent_order_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_trash ON orders(trash);
CREATE INDEX idx_orders_countid ON orders(countid);
CREATE INDEX idx_orders_id_trgm ON orders USING GIN (order_id gin_trgm_ops);
CREATE INDEX idx_order_stops_order_id ON order_stops(order_id);
CREATE INDEX idx_order_legs_order_id ON order_legs(order_id);
CREATE INDEX idx_shipment_details_origin_port ON shipment_details(origin_port);
CREATE INDEX idx_shipment_details_dest_port ON shipment_details(dest_port);

-- Update shipment_files index
DROP INDEX IF EXISTS idx_files_shipment;
CREATE INDEX idx_files_order ON shipment_files (order_id) WHERE trash = FALSE;

-- =========================================================================
-- 12. Rename old tables to _legacy (do NOT drop)
-- =========================================================================
ALTER TABLE shipments RENAME TO _legacy_shipments;
ALTER TABLE ground_transport_orders RENAME TO _legacy_ground_transport_orders;
ALTER TABLE ground_transport_legs RENAME TO _legacy_ground_transport_legs;
