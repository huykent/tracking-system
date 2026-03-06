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
            console.log('[Server] DB ready — starting cron scheduler');
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
