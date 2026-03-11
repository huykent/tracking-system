const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { saveTrackingResult } = require('../services/trackingOrchestrator');
const TrackingMoreProvider = require('../providers/trackingmore');

const WEBHOOK_SECRET = process.env.TRACKINGMORE_WEBHOOK_SECRET;

/**
 * Verify TrackingMore Webhook Signature
 */
function verifySignature(req) {
    if (!WEBHOOK_SECRET) {
        console.warn('[Webhook] WEBHOOK_SECRET not set, skipping verification (INSECURE)');
        return true;
    }

    const signature = req.headers['signature'];
    const timestamp = req.headers['timestamp'];

    if (!signature || !timestamp) return false;

    // HMAC-SHA256 of timestamp + raw body
    const data = timestamp + JSON.stringify(req.body);
    const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(data)
        .digest('base64');

    return signature === expectedSignature;
}

/**
 * POST /api/webhooks/trackingmore
 */
router.post('/trackingmore', async (req, res) => {
    console.log('[Webhook] Received TrackingMore update');

    if (!verifySignature(req)) {
        console.error('[Webhook] Invalid signature');
        return res.status(401).send('Invalid signature');
    }

    const payload = req.body;

    // TrackingMore v4 webhook payload structure:
    // { "meta": {...}, "data": [ {...}, ... ] }
    const data = payload.data?.[0] || payload.data;
    if (!data || !data.tracking_number) {
        console.warn('[Webhook] Malformed payload');
        return res.status(400).send('Malformed payload');
    }

    try {
        // Use provider's normalize logic
        const provider = new TrackingMoreProvider();
        const normalized = provider._normalize(payload, data.tracking_number);

        if (normalized) {
            normalized.api_provider = 'trackingmore';
            await saveTrackingResult(normalized);
            console.log(`[Webhook] Updated ${data.tracking_number} via Webhook`);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('[Webhook] Processing error:', err.message);
        res.status(500).send('Internal error');
    }
});

module.exports = router;
