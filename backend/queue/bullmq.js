const { Queue } = require('bullmq');
const { redis } = require('../redis');

const TRACKING_QUEUE_NAME = 'tracking-jobs';

const trackingQueue = new Queue(TRACKING_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
    },
});

/**
 * Add a single shipment to the tracking queue
 */
async function addTrackingJob(trackingNumber, carrier, priority = 'normal') {
    return trackingQueue.add(
        'track-shipment',
        { trackingNumber, carrier },
        {
            priority: priority === 'high' ? 1 : 10,
            jobId: `track-${trackingNumber}-${Date.now()}`,
        }
    );
}

/**
 * Bulk add shipments
 */
async function bulkAddTrackingJobs(shipments) {
    const jobs = shipments.map(s => ({
        name: 'track-shipment',
        data: { trackingNumber: s.tracking_number, carrier: s.carrier },
        opts: { priority: 10, jobId: `track-${s.tracking_number}-${Date.now()}` },
    }));
    return trackingQueue.addBulk(jobs);
}

async function getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        trackingQueue.getWaitingCount(),
        trackingQueue.getActiveCount(),
        trackingQueue.getCompletedCount(),
        trackingQueue.getFailedCount(),
        trackingQueue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
}

module.exports = { trackingQueue, addTrackingJob, bulkAddTrackingJobs, getQueueStats, TRACKING_QUEUE_NAME };
