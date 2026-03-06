const cron = require('node-cron');
const { query } = require('../db');
const { bulkAddTrackingJobs } = require('../queue/bullmq');

console.log('[Cron] Scheduler starting...');

// ─── Every 5 minutes: queue pending/delivering shipments ──
cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Running tracking job dispatch...');
    try {
        const { rows } = await query(
            `SELECT tracking_number, carrier FROM shipments
             WHERE delivery_status IN ('pending', 'delivering')
             AND (last_tracking_update IS NULL OR last_tracking_update < NOW() - INTERVAL '10 minutes')
             ORDER BY last_tracking_update ASC NULLS FIRST
             LIMIT 100`
        );

        if (rows.length === 0) {
            console.log('[Cron] No shipments need updating');
            return;
        }

        await bulkAddTrackingJobs(rows);
        console.log(`[Cron] Queued ${rows.length} shipments for tracking`);
    } catch (err) {
        console.error('[Cron] Error dispatching jobs:', err.message);
    }
});

// ─── Daily midnight: reset API provider counters ──────────
cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Resetting daily API limits...');
    try {
        await query(`UPDATE api_providers SET used_today = 0, last_reset = NOW()`);
        console.log('[Cron] API limits reset');
    } catch (err) {
        console.error('[Cron] Failed to reset API limits:', err.message);
    }
});

module.exports = {};
