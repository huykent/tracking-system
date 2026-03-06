"use strict";

const cron = require('node-cron');
const db = require('./db');
const { processShipment } = require('./tracking');

// Cron job every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    console.log('Running cron job to update tracking...');
    try {
        const result = await db.query("SELECT tracking_number, carrier FROM shipments WHERE delivery_status != 'delivered'");

        for (const shipment of result.rows) {
            await processShipment(shipment);
        }
    } catch (err) {
        console.error('Cron job error:', err);
    }
});

console.log('Worker cron started.');
