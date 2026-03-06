const express = require('express');
const router = express.Router();
const { query } = require('../db');

// ─── GET /api/settings ────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { rows } = await query(`SELECT key, value FROM settings ORDER BY key`);
        const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
        // Mask sensitive fields
        if (settings.telegram_bot_token) settings.telegram_bot_token = '***';
        if (settings.admin_password) settings.admin_password = '***';
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PATCH /api/settings ──────────────────────────────────
router.patch('/', async (req, res) => {
    try {
        const updates = req.body; // { key: value, ... }
        for (const [key, value] of Object.entries(updates)) {
            if (typeof value === 'undefined') continue;
            await query(
                `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
                 ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
                [key, String(value)]
            );
        }
        // Invalidate the debug mode cache if it was just changed
        if ('debug_mode' in updates) {
            try { require('../services/apiLogger').invalidateCache(); } catch { }
        }
        res.json({ saved: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/settings/telegram/test ────────────────────
router.post('/telegram/test', async (req, res) => {
    try {
        const { sendMessage } = require('../services/telegramService');
        await sendMessage('✅ Test message from Logistics Tracking System!');
        res.json({ sent: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
