const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { getQueueStats } = require('../queue/bullmq');

// ─── GET /api/dashboard/stats ────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const [statusCounts, carrierCounts, dailyShipments, queueStats] = await Promise.all([
            query(`
                SELECT delivery_status, COUNT(*) as count
                FROM shipments
                GROUP BY delivery_status
            `),
            query(`
                SELECT carrier, COUNT(*) as count
                FROM shipments
                WHERE carrier IS NOT NULL
                GROUP BY carrier
                ORDER BY count DESC
                LIMIT 10
            `),
            query(`
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM shipments
                WHERE created_at > NOW() - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            `),
            getQueueStats(),
        ]);

        const stats = { pending: 0, delivering: 0, delivered: 0, failed: 0 };
        statusCounts.rows.forEach(r => { stats[r.delivery_status] = parseInt(r.count); });

        res.json({
            total: Object.values(stats).reduce((a, b) => a + b, 0),
            ...stats,
            carriers: carrierCounts.rows.map(r => ({ carrier: r.carrier, count: parseInt(r.count) })),
            daily: dailyShipments.rows.map(r => ({ date: r.date, count: parseInt(r.count) })),
            queue: queueStats,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/dashboard/providers ────────────────────────
router.get('/providers', async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT name, label, enabled, daily_limit, used_today, priority
             FROM api_providers
             ORDER BY priority ASC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
