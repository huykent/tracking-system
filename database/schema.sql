-- =========================================================
-- LOGISTICS TRACKING SYSTEM — PostgreSQL Schema
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── API Providers ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_providers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) UNIQUE NOT NULL,   -- e.g. 'ship24', '17track', 'kuaidi100'
    label       VARCHAR(100),                  -- Display name
    api_key     TEXT,
    api_secret  TEXT,                          -- For providers that need it
    enabled     BOOLEAN DEFAULT TRUE,
    daily_limit INTEGER DEFAULT 1000,
    used_today  INTEGER DEFAULT 0,
    priority    INTEGER DEFAULT 99,            -- Lower number = higher priority
    last_reset  TIMESTAMP DEFAULT NOW(),       -- For daily limit reset tracking
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- ─── Settings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT,
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- ─── Shipments ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipments (
    id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tracking_number      VARCHAR(100) NOT NULL UNIQUE,
    carrier              VARCHAR(100),
    carrier_key          INTEGER,              -- 17Track numeric carrier key
    note                 TEXT,
    source_platform      VARCHAR(100),         -- e.g. 'Shopee', 'Lazada', 'Manual'
    ship_time            TIMESTAMP,
    delivery_status      VARCHAR(20) DEFAULT 'pending'
                            CHECK (delivery_status IN ('pending', 'delivering', 'delivered', 'failed')),
    last_tracking_update TIMESTAMP,
    last_event_hash      VARCHAR(64),          -- SHA256 of last event to detect changes
    api_provider         VARCHAR(50),          -- Which API last tracked this
    created_at           TIMESTAMP DEFAULT NOW(),
    updated_at           TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_status       ON shipments(delivery_status);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier      ON shipments(carrier);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at   ON shipments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_updated_at   ON shipments(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_num ON shipments(tracking_number);

-- ─── Tracking Events ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracking_events (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tracking_number VARCHAR(100) NOT NULL,
    event_time      TIMESTAMP,
    status          TEXT,
    location        TEXT,
    description     TEXT,
    raw_data        JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_number ON tracking_events(tracking_number);
CREATE INDEX IF NOT EXISTS idx_tracking_events_time   ON tracking_events(event_time DESC);

-- ─── Default API Providers ────────────────────────────────
INSERT INTO api_providers (name, label, enabled, daily_limit, priority) VALUES
    ('ship24',     'Ship24',     false, 1000, 1),
    ('17track',    '17Track',    false, 1000, 2),
    ('kuaidi100',  'Kuaidi100',  false, 500,  3),
    ('cainiao',    'Cainiao',    false, 500,  4),
    ('trackingmore','TrackingMore', false, 300, 5)
ON CONFLICT (name) DO NOTHING;

-- ─── Default Settings ─────────────────────────────────────
INSERT INTO settings (key, value) VALUES
    ('telegram_bot_token', ''),
    ('telegram_chat_id', ''),
    ('telegram_enabled', 'false'),
    ('tracking_interval_minutes', '5'),
    ('debug_mode', 'false'),
    ('admin_password', 'admin123')
ON CONFLICT (key) DO NOTHING;

-- ─── Function: auto update updated_at ─────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shipments_updated_at
    BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER api_providers_updated_at
    BEFORE UPDATE ON api_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── API Logs (Debug Mode) ────────────────────────────────
CREATE TABLE IF NOT EXISTS api_logs (
    id SERIAL PRIMARY KEY,
    tracking_number VARCHAR(100),
    provider VARCHAR(50),
    request_url TEXT,
    request_method VARCHAR(10),
    request_payload JSONB,
    response_status INTEGER,
    response_payload JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_tracking ON api_logs(tracking_number);
CREATE INDEX IF NOT EXISTS idx_api_logs_provider ON api_logs(provider);
CREATE INDEX IF NOT EXISTS idx_api_logs_created  ON api_logs(created_at DESC);
