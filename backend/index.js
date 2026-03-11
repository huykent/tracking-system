const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ───────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ─── Routes ──────────────────────────────────────────────
app.use('/api/shipments', require('./api/shipments'));
app.use('/api/dashboard', require('./api/dashboard'));
app.use('/api/providers', require('./api/providers'));
app.use('/api/settings', require('./api/settings'));
app.use('/api/logs', require('./api/logs'));
app.use('/api/webhooks', require('./api/webhooks'));

// ─── Health check ─────────────────────────────────────────
app.get('/health', async (req, res) => {
    const { pool } = require('./db');
    const { redis } = require('./redis');
    try {
        await pool.query('SELECT 1');
        const ping = await redis.ping();
        res.json({ status: 'ok', db: 'connected', redis: ping === 'PONG' ? 'connected' : 'error' });
    } catch (err) {
        res.status(503).json({ status: 'error', message: err.message });
    }
});

// ─── Error handler ────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[Server] Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────
app.listen(PORT, async () => {
    console.log(`[Server] Backend running on http://localhost:${PORT}`);
    // Wait for DB then start cron (avoid race with postgres container)
    const { pool } = require('./db');
    let attempts = 0;
    const tryStart = async () => {
        try {
            await pool.query('SELECT 1');
            console.log('[Server] DB ready...');

            // Auto-migrate tables
            await pool.query(`
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
            `);

            await pool.query(`
                INSERT INTO settings (key, value) VALUES ('debug_mode', 'false')
                ON CONFLICT (key) DO NOTHING;
            `);

            await pool.query(`
                INSERT INTO settings (key, value) VALUES ('tracking_interval_minutes', '5')
                ON CONFLICT (key) DO NOTHING;
            `);

            console.log('[Server] Migrations complete — starting cron scheduler');
            require('./cron/scheduler');
        } catch (err) {
            attempts++;
            if (attempts < 10) {
                console.warn(`[Server] DB not ready yet (attempt ${attempts}), retrying in 3s...`);
                setTimeout(tryStart, 3000);
            } else {
                console.error('[Server] Could not connect to DB after 10 attempts:', err.message);
            }
        }
    };
    setTimeout(tryStart, 2000); // give pg a 2s head start
});

module.exports = app;
