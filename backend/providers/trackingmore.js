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

    _headers() {
        return {
            'Tracking-Api-Key': this.apiKey,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Map internal carrier names/labels to TrackingMore courier_code.
     * Returns null if unknown — caller will omit courier_code for auto-detect.
     */
    _getCarrierCode(carrierName) {
        if (!carrierName) return null;

        // Normalize: lowercase, strip spaces/hyphens/dots/underscores
        const key = String(carrierName).toLowerCase().replace(/[\s\-_\.]+/g, '');

        const map = {
            // SF Express
            shunfeng: 'sf-express', sfexpress: 'sf-express', sf: 'sf-express',
            // YTO Express
            yuantong: 'yto-express', yto: 'yto-express', ytoexpress: 'yto-express',
            // ZTO Express
            zhongtong: 'zto-express', zto: 'zto-express', ztoexpress: 'zto-express',
            // STO Express
            shentong: 'sto-express', sto: 'sto-express', stoexpress: 'sto-express',
            // Yunda
            yunda: 'yunda-express', yundaexpress: 'yunda-express',
            // Best Express
            baishi: 'best-express', best: 'best-express', bestexpress: 'best-express',
            // J&T Express
            jt: 'jt-express', jtexpress: 'jt-express', jnt: 'jt-express',
            'jt-vn': 'jtexpress-vn', 'jtexpress-vn': 'jtexpress-vn',
            // Cainiao
            cainiao: 'cainiao',
            // 4PX
            '4px': '4px',
            // China Post
            chinapost: 'china-post',
            // EMS
            ems: 'china-ems',
            // Yanwen
            yanwen: 'yanwen',
            // International
            ups: 'ups', fedex: 'fedex', dhl: 'dhl', usps: 'usps',
            // JD Logistics
            jd: 'jd-express', jdexpress: 'jd-express',
            // YunExpress
            yunexpress: 'yunexpress',
            // Vietnamese Carriers
            ghn: 'ghn', giaohangnhanh: 'ghn',
            ghtk: 'ghtk', giaohangtietkiem: 'ghtk',
            viettel: 'viettel-post', viettelpost: 'viettel-post', vtpl: 'viettel-post',
            vnpost: 'vietnam-post', vietnampost: 'vietnam-post',
            ninjavan: 'ninjavan', ninja: 'ninjavan',
            lalamove: 'lalamove', grab: 'grab-express',
        };

        const code = map[key];
        if (!code) {
            console.warn(`[TrackingMore] Unknown carrier: "${carrierName}" (key: "${key}") — will let auto-detect`);
        }
        return code || null;
    }

    async detectCourier(trackingNumber) {
        try {
            const res = await axios.post(
                'https://api.trackingmore.com/v4/couriers/detect',
                { tracking_number: trackingNumber },
                { headers: this._headers(), timeout: 10000 }
            );
            return res.data?.data?.[0]?.courier_code || null;
        } catch (err) {
            console.warn(`[TrackingMore] Detection failed for ${trackingNumber}:`, err.message);
            return null;
        }
    }

    async track(trackingNumber, carrierName) {
        try {
            // 1. Determine courier code
            let courierCode = this._getCarrierCode(carrierName);
            if (!courierCode) {
                courierCode = await this.detectCourier(trackingNumber);
            }

            // 2. Create tracking (using BATCH for one or more)
            const batchPayload = [{
                tracking_number: trackingNumber,
                courier_code: courierCode || undefined
            }];

            let trackingData = null;
            try {
                const res = await axios.post(
                    'https://api.trackingmore.com/v4/trackings/batch',
                    batchPayload,
                    { headers: this._headers(), timeout: 10000 }
                );

                if (res.data?.data?.[0]) {
                    trackingData = res.data;
                }
            } catch (e) {
                console.warn(`[TrackingMore] Batch create warning for ${trackingNumber}`);
            }

            // 3. Fetch current status
            if (!trackingData) {
                // Official v4 recommended GET: /trackings/get?tracking_numbers=...
                // Removed courier_code from query as it might cause 4130 "Invalid field name"
                const reqUrl = `https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${trackingNumber}`;
                console.log(`[TrackingMore] Fetching: ${reqUrl}`);

                const res = await axios.get(reqUrl, {
                    headers: this._headers(),
                    timeout: 10000
                });
                trackingData = res.data;
            }

            await logApiCall({
                trackingNumber, provider: this.name, requestUrl: 'API', requestMethod: 'TrackingMore-v4',
                requestPayload: batchPayload, responseStatus: 200, responsePayload: trackingData
            });

            const normalized = this._normalize(trackingData, trackingNumber);
            if (normalized && normalized.events.length === 0 && !normalized.delivery_status) {
                console.log(`[TrackingMore] ${trackingNumber} has no status yet (pending)`);
            }
            return normalized;

        } catch (err) {
            const errorData = err.response?.data;
            console.error(`[TrackingMore] Request failed for ${trackingNumber}:`, JSON.stringify(errorData || err.message));

            // Total fallback for 4130: try the old style singular param just in case
            if (err.response?.status === 400 && errorData?.meta?.code === 4130) {
                try {
                    console.log(`[TrackingMore] 4130 detected, trying singular fallback...`);
                    const fallbackUrl = `https://api.trackingmore.com/v4/trackings/get?tracking_number=${trackingNumber}`;
                    const res = await axios.get(fallbackUrl, { headers: this._headers(), timeout: 10000 });
                    return this._normalize(res.data, trackingNumber);
                } catch (e) {
                    console.error(`[TrackingMore] Singular fallback also failed:`, e.message);
                }
            }

            await logApiCall({
                trackingNumber, provider: this.name, requestUrl: 'API', requestMethod: 'GET/POST',
                errorMessage: err.message, responseStatus: err.response?.status, responsePayload: errorData
            });
            return null;
        }
    }

    _normalize(data, trackingNumber) {
        // Handle array (from batch or bulk search) or object (from single search)
        const item = Array.isArray(data?.data) ? data.data.find(d => d.tracking_number === trackingNumber) : data?.data;
        if (!item) return null;

        /**
         * TrackingMore status values:
         * pending, info_received, in_transit, picking, out_for_delivery,
         * delivered, expired, failed_attempt, exception, returning, returned
         */
        let delivery_status = 'pending';
        const tmStatus = item.delivery_status;

        if (tmStatus === 'delivered') delivery_status = 'delivered';
        else if (['in_transit', 'picking', 'out_for_delivery', 'info_received'].includes(tmStatus)) delivery_status = 'delivering';
        else if (['failed_attempt', 'exception', 'expired'].includes(tmStatus)) delivery_status = 'failed';
        else if (['returning', 'returned'].includes(tmStatus)) delivery_status = 'failed';
        else if (tmStatus && tmStatus !== 'pending') delivery_status = 'delivering';

        // Collect events from origin_info and destination_info
        const events = [];
        const originTrack = item.origin_info?.trackinfo || [];
        const destTrack = item.destination_info?.trackinfo || [];
        const allEvents = [...originTrack, ...destTrack];

        for (const e of allEvents) {
            events.push({
                event_time: e.checkpoint_date,
                status: e.status_description || e.checkpoint_delivery_status,
                location: e.location || e.city || '',
                description: e.details || e.status_description,
                raw_data: e
            });
        }

        // Sort most recent first
        events.sort((a, b) => new Date(b.event_time) - new Date(a.event_time));

        return {
            tracking_number: trackingNumber,
            carrier: item.courier_code || carrierName,
            delivery_status,
            events
        };
    }
}

module.exports = TrackingMoreProvider;
