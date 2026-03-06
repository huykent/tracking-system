CREATE TABLE shipments (
    id SERIAL PRIMARY KEY,
    tracking_number VARCHAR(100) UNIQUE NOT NULL,
    carrier VARCHAR(50),
    note TEXT,
    ship_time TIMESTAMP,
    delivery_status VARCHAR(50) DEFAULT 'pending',
    source_platform VARCHAR(50) DEFAULT 'manual',
    last_tracking_update TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tracking_events (
    id SERIAL PRIMARY KEY,
    tracking_number VARCHAR(100) REFERENCES shipments(tracking_number) ON DELETE CASCADE,
    event_time TIMESTAMP,
    status VARCHAR(50),
    location TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shipments_tracking_number ON shipments(tracking_number);
CREATE INDEX idx_shipments_delivery_status ON shipments(delivery_status);
CREATE INDEX idx_tracking_events_tracking_number ON tracking_events(tracking_number);
