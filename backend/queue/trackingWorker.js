const { Worker } = require('bullmq');
const { redis } = require('../redis');
const { trackShipment, saveTrackingResult } = require('../services/trackingOrchestrator');
const { notifyNewEvent, notifyDelivered, notifyFailed } = require('../services/telegramService');
const { TRACKING_QUEUE_NAME } = require('./bullmq');
const { query } = require('../db');

console.log('[Worker] Starting tracking worker...');

const worker = new Worker(
    TRACKING_QUEUE_NAME,
    async (job) => {
        const { trackingNumber, carrier } = job.data;
        console.log(`[Worker] Processing job for ${trackingNumber}`);

        try {
            // 1. Call tracking API
            const result = await trackShipment(trackingNumber, carrier);
            if (!result) {
                console.warn(`[Worker] No result for ${trackingNumber}`);
                return;
            }

            // 2. Save events and detect changes
            const { hasNewEvent, statusChanged, latestEvent } = await saveTrackingResult(result);

            // 3. Send notifications if status changed
            if (hasNewEvent || statusChanged) {
                // Get carrier label from DB
                const { rows: [shipment] } = await query(
                    `SELECT carrier FROM shipments WHERE tracking_number = $1`,
                    [trackingNumber]
                );
                const carrierLabel = shipment?.carrier || carrier;

                if (result.delivery_status === 'delivered') {
                    await notifyDelivered(trackingNumber, carrierLabel);
                } else if (result.delivery_status === 'failed') {
                    await notifyFailed(trackingNumber, carrierLabel, latestEvent?.description);
                } else if (hasNewEvent) {
                    await notifyNewEvent(trackingNumber, carrierLabel, latestEvent);
                }
            }

            console.log(`[Worker] Done: ${trackingNumber} → ${result.delivery_status}`);
            return result.delivery_status;
        } catch (err) {
            console.error(`[Worker] Job failed for ${trackingNumber}:`, err.message);
            throw err; // Re-throw for BullMQ retry
        }
    },
    {
        connection: redis,
        concurrency: 5, // Process up to 5 shipments simultaneously
        limiter: {
            max: 10,       // Max 10 jobs per interval
            duration: 1000 // Per second
        },
    }
);

worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err.message);
});

worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[Worker] Shutting down...');
    await worker.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await worker.close();
    process.exit(0);
});
