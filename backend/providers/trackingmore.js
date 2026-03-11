const axios = require('axios');
const { logApiCall } = require('../services/apiLogger');

/**
 * TrackingMore Provider (v4 API)
 */
class TrackingMoreProvider {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.name = 'trackingmore';
    }

    /**
     * Internal headers for TrackingMore v4
     */
    _headers() {
        return {
            'Tracking-Api-Key': this.apiKey,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
    }

    /**
     * Rely on API detection. We no longer map names locally.
     * Only returns back clear, known courier codes if already provided.
     */
    _getCarrierCode(carrierName) {
        if (!carrierName || String(carrierName).toLowerCase() === 'unknown') return null;
        // If it looks like a clean code (no spaces, lowercase), we try to use it
        const clean = String(carrierName).toLowerCase().trim();
        if (/^[a-z0-9\-]+$/.test(clean) && clean.length < 20) {
            return clean;
        }
        return null;
    }

    async detectCourier(trackingNumber) {
        try {
            const tn = String(trackingNumber).trim();
            const res = await axios({
                method: 'POST',
                url: 'https://api.trackingmore.com/v4/couriers/detect',
                headers: this._headers(),
                data: `{"tracking_number":"${tn}"}`,
                timeout: 10000
            });

            const couriers = res.data?.data || [];
            if (couriers.length === 0) return null;

            let selected = couriers[0];

            // INTELLIGENT MATCHING: YT numbers are often YTO or YunExpress
            if (tn.startsWith('YT')) {
                const preference = ['yto', 'yunexpress'];
                const match = couriers.find(c => preference.includes(c.courier_code));
                if (match) selected = match;
            } else if (tn.startsWith('JDK')) {
                const match = couriers.find(c => c.courier_code.includes('jd'));
                if (match) selected = match;
            }

            return {
                courier_code: selected.courier_code,
                courier_name: selected.courier_name
            };
        } catch (err) {
            console.warn(`[TrackingMore] Detect failed:`, err.response?.data?.meta?.message || err.message);
            return null;
        }
    }

    async track(trackingNumber, carrierName) {
        const tn = String(trackingNumber).trim();
        try {
            // 1. Resolve Courier
            let courierCode = this._getCarrierCode(carrierName);
            let detectedData = null;

            if (!courierCode) {
                detectedData = await this.detectCourier(tn);
                if (detectedData) courierCode = detectedData.courier_code;
            }

            // 2. Sync to TM
            let trackingData = null;
            const payload = { tracking_number: tn };
            if (courierCode) payload.courier_code = courierCode;

            try {
                const res = await axios({
                    method: 'POST',
                    url: 'https://api.trackingmore.com/v4/trackings/create',
                    headers: this._headers(),
                    data: payload, // Axios will stringify this correctly
                    timeout: 10000
                });
                // v4 returns 200 on success, 4101 if exists
                if (res.data?.meta?.code === 200 || res.data?.meta?.code === 4101) {
                    trackingData = res.data;
                }
            } catch (e) {
                const meta = e.response?.data?.meta;
                if (meta?.code !== 4101) {
                    console.warn(`[TrackingMore] Create warning for ${tn}:`, meta?.message || e.message);
                }
            }

            // 3. Guarantee Detail
            const item = this._extractItem(trackingData, tn);
            if (!item || !item.origin_info || !item.delivery_status) {
                const res = await axios({
                    method: 'GET',
                    url: `https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${tn}`,
                    headers: this._headers(),
                    timeout: 10000
                });
                trackingData = res.data;
            }

            await logApiCall({
                trackingNumber: tn, provider: this.name, requestUrl: 'API', requestMethod: 'STAGES',
                requestPayload: payload, responseStatus: 200, responsePayload: trackingData
            });

            return this._normalize(trackingData, tn);
        } catch (err) {
            const errorData = err.response?.data;
            console.error(`[TrackingMore] Request failed for ${tn}:`, JSON.stringify(errorData || err.message));

            await logApiCall({
                trackingNumber: tn, provider: this.name, requestUrl: 'API', requestMethod: 'STAGES',
                errorMessage: err.message, responseStatus: err.response?.status, responsePayload: errorData
            });
            return null;
        }
    }

    /**
     * Internal helper to find the tracking item in TM's varied response formats
     */
    _extractItem(data, trackingNumber) {
        if (!data?.data) return null;
        const list = Array.isArray(data.data) ? data.data : [data.data];
        // Match by tracking_number OR order_number (v4 versatility)
        return list.find(d => d && (d.tracking_number === trackingNumber || d.order_number === trackingNumber));
    }

    _normalize(data, trackingNumber) {
        const item = this._extractItem(data, trackingNumber);
        if (!item) return null;

        console.log(`[TrackingMore] Normalizing ${trackingNumber}, API Carrier: ${item.courier_name} (${item.courier_code})`);

        let delivery_status = 'pending';
        const tmStatus = item.delivery_status;

        if (tmStatus === 'delivered') delivery_status = 'delivered';
        else if (['in_transit', 'picking', 'out_for_delivery', 'info_received'].includes(tmStatus)) delivery_status = 'delivering';
        else if (['failed_attempt', 'exception', 'expired', 'returning', 'returned'].includes(tmStatus)) delivery_status = 'failed';
        else if (tmStatus && tmStatus !== 'pending') delivery_status = 'delivering';

        const events = [];
        const originTrack = item.origin_info?.trackinfo || [];
        const destTrack = item.destination_info?.trackinfo || [];

        for (const e of [...originTrack, ...destTrack]) {
            events.push({
                event_time: e.checkpoint_date,
                status: e.status_description || e.checkpoint_delivery_status,
                location: e.location || e.city || '',
                description: e.details || e.status_description,
                raw_data: e
            });
        }

        events.sort((a, b) => new Date(b.event_time) - new Date(a.event_time));

        return {
            tracking_number: trackingNumber,
            // Source of truth: the official Courier Name from TM
            carrier: item.courier_name || item.courier_code || 'Unknown',
            delivery_status,
            events
        };
    }
}

module.exports = TrackingMoreProvider;
