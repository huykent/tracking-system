const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    router.get('/summary', async (req, res) => {
        try {
            const summary = await db.query(`
        SELECT 
          COUNT(*) as total_shipments,
          SUM(CASE WHEN delivery_status = 'delivered' THEN 1 ELSE 0 END) as delivered_shipments,
          SUM(CASE WHEN delivery_status = 'pending' THEN 1 ELSE 0 END) as delivering_shipments,
          SUM(CASE WHEN delivery_status = 'failed' THEN 1 ELSE 0 END) as failed_shipments,
          SUM(CASE WHEN delivery_status = 'fake_tracking' THEN 1 ELSE 0 END) as fake_tracking
        FROM shipments
      `);
            res.json(summary.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/carriers', async (req, res) => {
        try {
            const carriers = await db.query(`
        SELECT 
          carrier,
          COUNT(*) as total_shipments,
          SUM(CASE WHEN delivery_status = 'delivered' THEN 1 ELSE 0 END) as delivered_shipments,
          (SUM(CASE WHEN delivery_status = 'delivered' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as success_rate
        FROM shipments
        GROUP BY carrier
      `);
            res.json(carriers.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/map', async (req, res) => {
        try {
            // Get all tracking coordinates grouped by shipment
            const events = await db.query(`
                SELECT e.tracking_number, e.location, e.latitude, e.longitude, e.event_time, e.status, s.delivery_status
                FROM tracking_events e
                JOIN shipments s ON e.tracking_number = s.tracking_number
                WHERE e.latitude IS NOT NULL AND e.longitude IS NOT NULL
                ORDER BY e.tracking_number, e.event_time ASC
            `);

            const mapData = {};
            events.rows.forEach(evt => {
                if (!mapData[evt.tracking_number]) {
                    mapData[evt.tracking_number] = {
                        tracking_number: evt.tracking_number,
                        delivery_status: evt.delivery_status,
                        locations: []
                    };
                }
                mapData[evt.tracking_number].locations.push({
                    lat: evt.latitude,
                    lng: evt.longitude,
                    name: evt.location,
                    status: evt.status,
                    time: evt.event_time
                });
            });

            res.json(Object.values(mapData));
        } catch (err) {
            console.error("Map query error", err);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
