-- Migration 009: vehicle_types reference table + vehicle_type_id on ground_transport_orders

CREATE TABLE IF NOT EXISTS vehicle_types (
    vehicle_type_id   VARCHAR(30)   PRIMARY KEY,
    label             VARCHAR(100)  NOT NULL,
    category          VARCHAR(30)   NOT NULL,
    is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order        INTEGER       NOT NULL DEFAULT 0
);

INSERT INTO vehicle_types (vehicle_type_id, label, category, sort_order) VALUES
    ('lorry_1t',   '1 Ton Lorry',   'lorry',   10),
    ('lorry_3t',   '3 Ton Lorry',   'lorry',   20),
    ('lorry_5t',   '5 Ton Lorry',   'lorry',   30),
    ('lorry_10t',  '10 Ton Lorry',  'lorry',   40),
    ('trailer_20', '20ft Trailer',  'trailer', 50),
    ('trailer_40', '40ft Trailer',  'trailer', 60)
ON CONFLICT (vehicle_type_id) DO NOTHING;

ALTER TABLE ground_transport_orders
    ADD COLUMN IF NOT EXISTS vehicle_type_id VARCHAR(30) NULL
        REFERENCES vehicle_types(vehicle_type_id);
