const express = require('express');
const router = express.Router();
const { query } = require('../db');

// ─── GET /api/logs ────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 50, tracking_number } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = '';
        const params = [parseInt(limit), offset];
        if (tracking_number) {
            where = 'WHERE tracking_number = $3';
            params.push(tracking_number);
        }

        const [dataRes, countRes] = await Promise.all([
            query(`
                SELECT id, tracking_number, provider, request_url, request_method, response_status, created_at,
                       error_message, request_payload, response_payload 
                FROM api_logs 
                ${where} 
                ORDER BY created_at DESC 
                LIMIT $1 OFFSET $2
            `, params),
            query(`SELECT COUNT(*) FROM api_logs ${where}`, tracking_number ? [tracking_number] : [])
        ]);

        res.json({
            data: dataRes.rows,
            total: parseInt(countRes.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /api/logs ────────────────────────────────────
router.delete('/', async (req, res) => {
    try {
        await query(`DELETE FROM api_logs`);
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
