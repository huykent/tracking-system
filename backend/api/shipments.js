const express = require('express');
const { detectCarrier, processShipment } = require('../tracking');

module.exports = (db) => {
    const router = express.Router();

    router.post('/', async (req, res) => {
        let { tracking_number, carrier, note, source_platform } = req.body;
        if (!carrier) carrier = detectCarrier(tracking_number);
        try {
            await db.run(
                'INSERT INTO shipments (tracking_number, carrier, note, source_platform, delivery_status) VALUES (?, ?, ?, ?, ?)',
                [tracking_number, carrier, note, source_platform || 'manual', 'pending']
            );
            const result = await db.query('SELECT * FROM shipments WHERE tracking_number = ?', [tracking_number]);

            // Auto fetch first logic
            await processShipment(result.rows[0]);

            const final_res = await db.query('SELECT * FROM shipments WHERE tracking_number = ?', [tracking_number]);
            res.status(201).json(final_res.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/', async (req, res) => {
        try {
            const result = await db.query('SELECT * FROM shipments ORDER BY created_at DESC LIMIT 50');
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/:tracking_number', async (req, res) => {
        try {
            const { tracking_number } = req.params;
            const shipment = await db.query('SELECT * FROM shipments WHERE tracking_number = ?', [tracking_number]);
            if (shipment.rows.length === 0) return res.status(404).json({ error: 'Not found' });

            const events = await db.query('SELECT * FROM tracking_events WHERE tracking_number = ? ORDER BY event_time DESC', [tracking_number]);
            res.json({ shipment: shipment.rows[0], events: events.rows });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/:tracking_number', async (req, res) => {
        try {
            const { tracking_number } = req.params;
            await db.run('DELETE FROM shipments WHERE tracking_number = ?', [tracking_number]);
            res.json({ success: true, tracking_number });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
