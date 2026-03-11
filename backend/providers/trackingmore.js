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
     * Map internal carrier names/labels to TrackingMore courier_code.
     * Returns null if unknown — caller will omit courier_code for auto-detect.
     */
    _getCarrierCode(carrierName) {
        if (!carrierName || String(carrierName).toLowerCase() === 'unknown') return null;

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
            console.warn(`[TrackingMore] No local mapping for: "${carrierName}"`);
        }
        return code || null;
    }

    async detectCourier(trackingNumber) {
        try {
            const tn = String(trackingNumber).trim();
            // Manual clean JSON string
            const data = `{"tracking_number":"${tn}"}`;

            const res = await axios({
                method: 'POST',
                url: 'https://api.trackingmore.com/v4/couriers/detect',
                headers: this._headers(),
                data: data,
                timeout: 10000
            });

            const first = res.data?.data?.[0]?.courier_code;
            if (first) console.log(`[TrackingMore] Detected ${first} for ${tn}`);
            return first || null;
        } catch (err) {
            console.warn(`[TrackingMore] Detect failed:`, err.response?.data?.meta?.message || err.message);
            return null;
        }
    }

    async track(trackingNumber, carrierName) {
        const tn = String(trackingNumber).trim();
        try {
            // STEP 1: Detect
            let courierCode = this._getCarrierCode(carrierName);
            if (!courierCode) {
                courierCode = await this.detectCourier(tn);
            }

            // STEP 2: Sync via CREATE (more reliable for single tracking than batch in some TM accounts)
            let trackingData = null;
            let payloadStr = '';
            try {
                // Construct clean payload string manually to avoid any "hidden" field issues
                payloadStr = `{"tracking_number":"${tn}"`;
                if (courierCode) payloadStr += `,"courier_code":"${courierCode}"`;
                payloadStr += `}`;

                const res = await axios({
                    method: 'POST',
                    url: 'https://api.trackingmore.com/v4/trackings/create',
                    headers: this._headers(),
                    data: payloadStr,
                    timeout: 10000
                });

                if (res.data?.meta?.code === 200 || res.data?.meta?.code === 4101) {
                    trackingData = res.data;
                    console.log(`[TrackingMore] Sync successful for ${tn}`);
                }
            } catch (e) {
                const meta = e.response?.data?.meta;
                if (meta?.code === 4101) {
                    // Logic handles this below by fetching if needed
                } else {
                    console.warn(`[TrackingMore] Sync error:`, meta?.message || e.message);
                }
            }

            // STEP 3: Get Status (using plural GET as requested)
            if (!trackingData || !this._extractItem(trackingData, tn)?.origin_info) {
                const res = await axios({
                    method: 'GET',
                    url: `https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${tn}`,
                    headers: this._headers(),
                    timeout: 10000
                });
                trackingData = res.data;
            }

            await logApiCall({
                trackingNumber: tn, provider: this.name, requestUrl: 'API-v4-Lifecycle', requestMethod: 'STAGES',
                requestPayload: payloadStr, responseStatus: 200, responsePayload: trackingData
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
        if (Array.isArray(data.data)) {
            return data.data.find(d => d && d.tracking_number === trackingNumber);
        }
        if (data.data.tracking_number === trackingNumber) {
            return data.data;
        }
        return null;
    }

    _normalize(data, trackingNumber) {
        const item = this._extractItem(data, trackingNumber);
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
            carrier: item.courier_code || 'Unknown',
            delivery_status,
            events
        };
    }
}

module.exports = TrackingMoreProvider;
