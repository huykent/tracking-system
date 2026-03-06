const axios = require('axios');
const { logApiCall } = require('../services/apiLogger');

const BASE_URL = 'https://api.ship24.com/public/v1';

/**
 * Ship24 Provider
 * 
 * API Reference (from OpenAPI spec):
 *   POST /trackers        → { data: { tracker: { trackerId, ... } } }  (201)
 *   GET  /trackers/:id/results → { data: { trackings: [ { tracker, shipment, events } ] } }
 */
class Ship24Provider {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.name = 'ship24';
    }

    _headers() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
        };
    }

    async track(trackingNumber, carrier) {
        try {
            // Step 1: Create tracker
            const createRes = await axios.post(
                `${BASE_URL}/trackers`,
                { trackingNumber },
                { headers: this._headers(), timeout: 10000 }
            );

            // Log create call
            await logApiCall({
                trackingNumber, provider: this.name,
                requestUrl: `${BASE_URL}/trackers`, requestMethod: 'POST',
                requestPayload: { trackingNumber },
                responseStatus: createRes?.status, responsePayload: createRes?.data
            });

            // Per OpenAPI spec: POST returns data.tracker.trackerId (singular)
            const trackerId = createRes.data?.data?.tracker?.trackerId;
            if (!trackerId) {
                console.error('[Ship24] Unexpected create response:', JSON.stringify(createRes.data));
                throw new Error('No tracker ID returned from Ship24');
            }

            // Step 2: Get tracking results
            const resultsUrl = `${BASE_URL}/trackers/${trackerId}/results`;
            const resultsRes = await axios.get(resultsUrl, {
                headers: this._headers(),
                timeout: 10000
            });

            await logApiCall({
                trackingNumber, provider: this.name,
                requestUrl: resultsUrl, requestMethod: 'GET',
                requestPayload: null,
                responseStatus: resultsRes?.status, responsePayload: resultsRes?.data
            });

            return this._normalize(resultsRes.data, trackingNumber);
        } catch (err) {
            console.error(`[Ship24] Error tracking ${trackingNumber}:`, err.message);
            await logApiCall({
                trackingNumber, provider: this.name, requestUrl: 'API', requestMethod: 'POST',
                errorMessage: err.message, responseStatus: err.response?.status, responsePayload: err.response?.data
            });
            return null;
        }
    }

    _normalize(data, trackingNumber) {
        // Per OpenAPI spec: GET results returns data.trackings[] (not data.trackers[])
        const tracking = data?.data?.trackings?.[0];
        if (!tracking) return null;

        const { shipment, events = [] } = tracking;

        // statusMilestone: in_transit, out_for_delivery, delivered, pickup, transit, ...
        // statusCategory: delivery, transit, warning, exception, info_received, ...
        const milestoneMap = {
            'delivered': 'delivered',
            'out_for_delivery': 'delivering',
            'in_transit': 'delivering',
            'pickup': 'delivering',
            'transit': 'delivering',
            'return': 'failed',
            'exception': 'failed',
            'failed_attempt': 'failed',
        };

        const latestEvent = events[0];
        const milestone = latestEvent?.statusMilestone || shipment?.statusMilestone || 'pending';
        const delivery_status = milestoneMap[milestone] || 'pending';

        return {
            tracking_number: trackingNumber,
            carrier: shipment?.trackingNumbers?.[0]?.courierCode
                || tracking.tracker?.courierCode
                || 'Unknown',
            delivery_status,
            events: events.map(e => ({
                event_time: e.occurrenceDatetime,
                status: e.statusMilestone || e.statusCategory,
                location: e.location || '',
                description: e.status || e.statusCode || '',
                raw_data: e,
            })),
        };
    }
}

module.exports = Ship24Provider;
