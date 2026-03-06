const axios = require('axios');
const { logApiCall } = require('../services/apiLogger');

const BASE_URL = 'https://api.ship24.com/public/v1';

/**
 * Ship24 Provider
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
            // Ship24: Create tracker then get results
            const createRes = await axios.post(
                `${BASE_URL}/trackers`,
                { trackingNumbers: [trackingNumber] },
                { headers: this._headers(), timeout: 10000 }
            );

            const trackerId = createRes.data?.data?.trackers?.[0]?.trackerId;
            if (!trackerId) throw new Error('No tracker ID returned from Ship24');

            // Get tracking results
            const resultsUrl = `${BASE_URL}/trackers/${trackerId}/results`;
            const resultsRes = await axios.get(resultsUrl, { headers: this._headers(), timeout: 10000 });

            await logApiCall({
                trackingNumber, provider: this.name, requestUrl: resultsUrl, requestMethod: 'GET',
                requestPayload: null, responseStatus: resultsRes?.status, responsePayload: resultsRes?.data
            });

            return this._normalize(resultsRes.data, trackingNumber);
        } catch (err) {
            console.error(`[Ship24] Error tracking ${trackingNumber}:`, err.message);
            await logApiCall({
                trackingNumber, provider: this.name, requestUrl: 'API', requestMethod: 'GET',
                errorMessage: err.message, responseStatus: err.response?.status, responsePayload: err.response?.data
            });
            return null;
        }
    }

    _normalize(data, trackingNumber) {
        const tracker = data?.data?.trackers?.[0];
        if (!tracker) return null;

        const shipment = tracker.shipment;
        const events = tracker.events || [];

        const statusMap = {
            'delivered': 'delivered',
            'in_transit': 'delivering',
            'out_for_delivery': 'delivering',
            'pickup': 'delivering',
            'failed_attempt': 'failed',
            'exception': 'failed',
        };

        const latestStatus = events[0]?.status?.category || 'pending';
        const delivery_status = statusMap[latestStatus] || 'delivering';

        return {
            tracking_number: trackingNumber,
            carrier: shipment?.shipmentPackages?.[0]?.carrier || 'Unknown',
            delivery_status,
            events: events.map(e => ({
                event_time: e.occurrenceDatetime,
                status: e.status?.category || e.status?.milestone,
                location: e.location,
                description: e.message || e.status?.name,
                raw_data: e,
            })),
        };
    }
}

module.exports = Ship24Provider;
