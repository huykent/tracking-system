const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { detectCarrier } = require('../services/carrierDetector');
const { addTrackingJob } = require('../queue/bullmq');
const { delCache } = require('../redis');

// ─── GET /api/shipments ───────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const {
            page = 1, limit = 50,
            status, carrier, search,
            sortBy = 'created_at', sortDir = 'desc'
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const conditions = [];
        const params = [];
        let idx = 1;

        if (status) { conditions.push(`delivery_status = $${idx++}`); params.push(status); }
        if (carrier) { conditions.push(`carrier ILIKE $${idx++}`); params.push(`%${carrier}%`); }
        if (search) {
            conditions.push(`(tracking_number ILIKE $${idx} OR note ILIKE $${idx} OR source_platform ILIKE $${idx})`);
            params.push(`%${search}%`); idx++;
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const allowedSorts = ['created_at', 'updated_at', 'delivery_status', 'carrier', 'ship_time'];
        const safeSort = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
        const safeDir = sortDir === 'asc' ? 'ASC' : 'DESC';

        const [dataRes, countRes] = await Promise.all([
            query(
                `SELECT id, tracking_number, carrier, delivery_status, note, source_platform,
                        ship_time, last_tracking_update, api_provider, created_at
                 FROM shipments ${where}
                 ORDER BY ${safeSort} ${safeDir}
                 LIMIT $${idx} OFFSET $${idx + 1}`,
                [...params, parseInt(limit), offset]
            ),
            query(`SELECT COUNT(*) FROM shipments ${where}`, params),
        ]);

        res.json({
            data: dataRes.rows,
            total: parseInt(countRes.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit),
        });
    } catch (err) {
        console.error('/shipments GET error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/shipments/:id ───────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT s.*, array_agg(
                json_build_object('id', te.id, 'event_time', te.event_time, 'status', te.status,
                    'location', te.location, 'description', te.description)
                ORDER BY te.event_time DESC NULLS LAST
            ) FILTER (WHERE te.id IS NOT NULL) AS events
             FROM shipments s
             LEFT JOIN tracking_events te ON s.tracking_number = te.tracking_number
             WHERE s.id::text = $1 OR s.tracking_number = $1
             GROUP BY s.id`,
            [req.params.id]
        );

        if (!rows[0]) return res.status(404).json({ error: 'Shipment not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/shipments ─────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const { tracking_number, note, source_platform, ship_time } = req.body;
        if (!tracking_number) return res.status(400).json({ error: 'tracking_number is required' });

        // Use async API detection fallback
        const { detectShipment } = require('../services/trackingOrchestrator');
        const detected = (await detectShipment(tracking_number)) || { label: 'Unknown', carrierKey: 0, name: 'unknown' };

        const { rows } = await query(
            `INSERT INTO shipments (tracking_number, carrier, carrier_key, note, source_platform, ship_time)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (tracking_number) DO UPDATE
             SET note = COALESCE(EXCLUDED.note, shipments.note), 
                 source_platform = COALESCE(EXCLUDED.source_platform, shipments.source_platform), 
                 updated_at = NOW()
             RETURNING *`,
            [tracking_number, detected.label, detected.carrierKey, note, source_platform, ship_time || null]
        );

        // Queue for immediate tracking
        await addTrackingJob(tracking_number, detected.name, 'high');

        res.status(201).json({ shipment: rows[0], carrier_detected: detected });
    } catch (err) {
        console.error('/shipments POST error:', err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// ─── POST /api/shipments/bulk ─────────────────────────────
router.post('/bulk', async (req, res) => {
    try {
        const { numbers } = req.body;
        if (!Array.isArray(numbers) || numbers.length === 0) {
            return res.status(400).json({ error: 'numbers array is required' });
        }

        const { detectShipment } = require('../services/trackingOrchestrator');
        const results = [];

        // Process in batches or concurrently with a limit if needed, 
        // but for now simple loop with async detect
        for (const tn of numbers.slice(0, 200)) {
            const detected = await detectShipment(tn);
            await query(
                `INSERT INTO shipments (tracking_number, carrier, carrier_key)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (tracking_number) DO NOTHING`,
                [tn, detected.label, detected.carrierKey]
            );
            results.push({ tracking_number: tn, carrier: detected });
        }

        const { bulkAddTrackingJobs } = require('../queue/bullmq');
        await bulkAddTrackingJobs(results.map(r => ({ tracking_number: r.tracking_number, carrier: r.carrier.name })));

        res.json({ added: results.length, carriers: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PATCH /api/shipments/:id ─────────────────────────────
router.patch('/:id', async (req, res) => {
    try {
        const { note, source_platform, ship_time, delivery_status } = req.body;
        const { rows } = await query(
            `UPDATE shipments SET
                note = COALESCE($1, note),
                source_platform = COALESCE($2, source_platform),
                ship_time = COALESCE($3, ship_time),
                delivery_status = COALESCE($4, delivery_status)
             WHERE id::text = $5 OR tracking_number = $5
             RETURNING *`,
            [note, source_platform, ship_time, delivery_status, req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Not found' });
        await delCache(`shipment:${rows[0].tracking_number}`);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /api/shipments/:id ────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const { rows } = await query(
            `DELETE FROM shipments WHERE id::text = $1 OR tracking_number = $1 RETURNING tracking_number`,
            [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Not found' });
        await delCache(`shipment:${rows[0].tracking_number}`);
        await query(`DELETE FROM tracking_events WHERE tracking_number = $1`, [rows[0].tracking_number]);
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/shipments/:id/refresh ─────────────────────
router.post('/:id/refresh', async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT tracking_number, carrier FROM shipments WHERE id::text = $1 OR tracking_number = $1`,
            [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Not found' });

        const { tracking_number, carrier } = rows[0];
        // Clear cache so we don't return stale data
        await delCache(`shipment:${tracking_number}`);

        // Run tracking immediately (synchronous) so the UI gets live result
        const { trackShipment, saveTrackingResult } = require('../services/trackingOrchestrator');
        try {
            const result = await trackShipment(tracking_number, carrier);
            if (result) {
                await saveTrackingResult(result);
                return res.json({ queued: false, refreshed: true, tracking_number, delivery_status: result.delivery_status, api_provider: result.api_provider });
            }
        } catch (trackErr) {
            console.warn(`[Refresh] Live tracking failed for ${tracking_number}: ${trackErr.message}, falling back to queue`);
        }

        // Fallback: queue for background processing
        await addTrackingJob(tracking_number, carrier, 'high');
        res.json({ queued: true, tracking_number });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
