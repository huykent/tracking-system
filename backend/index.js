const express = require('express');
const cors = require('cors');
require('./cron/scheduler'); // Start cron jobs

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
app.listen(PORT, () => {
    console.log(`[Server] Backend running on http://localhost:${PORT}`);
});

module.exports = app;
