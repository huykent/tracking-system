const { query } = require('../db');
const { getCount, incr, getCache, setCache } = require('../redis');
const Ship24Provider = require('../providers/ship24');
const Track17Provider = require('../providers/seventeen');
const Kuaidi100Provider = require('../providers/kuaidi100');
const TrackingMoreProvider = require('../providers/trackingmore');
const { detectCarrier } = require('./carrierDetector');
const crypto = require('crypto');

/**
 * Tracking Orchestrator
 * Handles: provider selection, API limits, fallback, caching, event storage
 */

function buildProvider(row) {
    switch (row.name) {
        case 'ship24': return new Ship24Provider(row.api_key);
        case '17track': return new Track17Provider(row.api_key);
        case 'kuaidi100': return new Kuaidi100Provider(row.api_key, row.api_secret);
        case 'trackingmore': return new TrackingMoreProvider(row.api_key);
        default: return null;
    }
}

/**
 * Get ordered, enabled providers from DB (respecting daily limits)
 */
async function getAvailableProviders() {
    const { rows } = await query(
        `SELECT * FROM api_providers
         WHERE enabled = true
         ORDER BY priority ASC`
    );

    if (rows.length === 0) {
        console.warn('[Orchestrator] No enabled providers found in DB');
    }

    const available = [];
    for (const row of rows) {
        // Check Redis for today's count
        const usedToday = await getCount(`ratelimit:${row.name}`);
        if (usedToday >= row.daily_limit) {
            console.log(`[Orchestrator] ${row.name} skipped — daily limit reached (${usedToday}/${row.daily_limit})`);
            continue;
        }
        available.push({ ...row, used_today_live: usedToday });
        console.log(`[Orchestrator] ${row.name} available (used ${usedToday}/${row.daily_limit}, hasKey=${!!row.api_key})`);
    }
    return available;
}

/**
 * Track a single shipment number using best available provider
 */
async function trackShipment(trackingNumber, preferredCarrier) {
    // Check cache first
    const cacheKey = `shipment:${trackingNumber}`;
    const cached = await getCache(cacheKey);
    if (cached) {
        console.log(`[Orchestrator] Cache hit for ${trackingNumber}`);
        return cached;
    }

    const providers = await getAvailableProviders();
    if (providers.length === 0) {
        throw new Error('No API providers available (all disabled or limit reached)');
    }

    // Ensure we have a proper carrier object with name and carrierKey
    let carrier = (typeof preferredCarrier === 'object' && preferredCarrier !== null && preferredCarrier.name)
        ? preferredCarrier
        : detectCarrier(trackingNumber);

    for (const providerRow of providers) {
        const provider = buildProvider(providerRow);
        if (!provider) continue;

        try {
            console.log(`[Orchestrator] Trying ${providerRow.name} for ${trackingNumber}`);
            const result = await provider.track(
                trackingNumber,
                carrier.name || carrier,
                carrier.carrierKey || 0
            );

            if (result) {
                // Increment usage counter in Redis (resets daily)
                await incr(`ratelimit:${providerRow.name}`, 86400);
                // Update used_today in DB
                await query(
                    `UPDATE api_providers SET used_today = used_today + 1 WHERE name = $1`,
                    [providerRow.name]
                );

                result.api_provider = providerRow.name;

                // Cache result for 5 minutes
                await setCache(cacheKey, result, 300);
                return result;
            }
        } catch (err) {
            console.warn(`[Orchestrator] ${providerRow.name} failed:`, err.message);
        }
    }

    throw new Error('All providers failed to track ' + trackingNumber);
}

/**
 * Save tracking result to DB and detect status changes
 */
async function saveTrackingResult(result) {
    const { tracking_number, delivery_status, events, api_provider } = result;

    // Hash of most recent event to detect changes
    const latestEvent = events?.[0];
    const eventHash = latestEvent
        ? crypto.createHash('sha256').update(JSON.stringify(latestEvent)).digest('hex')
        : null;

    // Check current hash in DB
    const { rows: [current] } = await query(
        `SELECT last_event_hash, delivery_status FROM shipments WHERE tracking_number = $1`,
        [tracking_number]
    );

    const hasNewEvent = current && eventHash && current.last_event_hash !== eventHash;
    const statusChanged = current && current.delivery_status !== delivery_status;

    // Update shipment
    await query(
        `UPDATE shipments
         SET delivery_status = $1, last_tracking_update = NOW(), last_event_hash = $2, api_provider = $3, updated_at = NOW()
         WHERE tracking_number = $4`,
        [delivery_status, eventHash, api_provider, tracking_number]
    );

    // Insert new events (skip duplicates by raw_data hash)
    for (const event of (events || [])) {
        const rawHash = crypto.createHash('sha256').update(JSON.stringify(event.raw_data || event)).digest('hex');
        await query(
            `INSERT INTO tracking_events (tracking_number, event_time, status, location, description, raw_data)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [tracking_number, event.event_time || null, event.status, event.location, event.description, JSON.stringify(event.raw_data)]
        ).catch(() => { }); // Ignore duplicate errors
    }

    return { hasNewEvent, statusChanged, latestEvent };
}

module.exports = { trackShipment, saveTrackingResult, getAvailableProviders };
