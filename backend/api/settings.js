const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const result = await db.query('SELECT key, value FROM settings');
            const settings = {};
            result.rows.forEach(row => {
                settings[row.key] = row.value;
            });
            res.json(settings);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/', async (req, res) => {
        const { key, value } = req.body;
        try {
            await db.run(
                'INSERT OR REPLACE INTO settings (id, key, value, updated_at) VALUES ((SELECT id FROM settings WHERE key = ?), ?, ?, CURRENT_TIMESTAMP)',
                [key, key, value]
            );
            res.json({ success: true, key, value });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
