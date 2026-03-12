const express = require('express');
const router = express.Router();
const { query } = require('../db');

// ─── GET /api/providers ───────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT id, name, label, enabled, daily_limit, used_today, priority, api_key,
                    CASE WHEN api_key IS NOT NULL AND api_key != '' THEN true ELSE false END as has_key
             FROM api_providers ORDER BY priority ASC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PATCH /api/providers/:name ──────────────────────────
router.patch('/:name', async (req, res) => {
    try {
        const { api_key, api_secret, enabled, daily_limit, priority } = req.body;
        const { rows } = await query(
            `UPDATE api_providers SET
                api_key     = COALESCE($1, api_key),
                api_secret  = COALESCE($2, api_secret),
                enabled     = COALESCE($3, enabled),
                daily_limit = COALESCE($4, daily_limit),
                priority    = COALESCE($5, priority)
             WHERE name = $6 RETURNING *`,
            [api_key || null, api_secret || null, enabled, daily_limit, priority, req.params.name]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Provider not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/providers/:name/reset ─────────────────────
router.post('/:name/reset', async (req, res) => {
    try {
        await query(`UPDATE api_providers SET used_today = 0 WHERE name = $1`, [req.params.name]);
        res.json({ reset: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
