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
            // Pass object directly to axios for standard JSON serialization
            const res = await axios.post(
                'https://api.trackingmore.com/v4/couriers/detect',
                { tracking_number: tn },
                { headers: this._headers(), timeout: 10000 }
            );

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
            // STEP 1: Detect Carrier
            let courierCode = this._getCarrierCode(carrierName);
            if (!courierCode) {
                courierCode = await this.detectCourier(tn);
            }

            // STEP 2: Sync via BATCH (as requested in Step 10 - most compatible)
            // Always send as an array [] for Batch endpoint
            const batchPayload = [{
                tracking_number: tn,
            }];
            if (courierCode) batchPayload[0].courier_code = courierCode;

            let trackingData = null;
            try {
                const res = await axios.post(
                    'https://api.trackingmore.com/v4/trackings/batch',
                    batchPayload,
                    { headers: this._headers(), timeout: 10000 }
                );
                // If batch returns successfully, result is in the data array
                if (res.data?.meta?.code === 200 && res.data?.data?.[0]) {
                    trackingData = res.data;
                    console.log(`[TrackingMore] Batch sync OK: ${tn}`);
                }
            } catch (e) {
                const meta = e.response?.data?.meta;
                // Batch usually doesn't fail with 4101 but we handle it just in case
                console.warn(`[TrackingMore] Batch warning:`, meta?.message || e.message);
            }

            // STEP 3: Get Result
            if (!trackingData || !this._extractItem(trackingData, tn)?.origin_info) {
                // Fetch info if initial create didn't provide enough detail
                const reqUrl = `https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${tn}`;
                console.log(`[TrackingMore] Step 3: Fetching from ${reqUrl}`);

                const res = await axios.get(reqUrl, {
                    headers: this._headers(),
                    timeout: 10000
                });
                trackingData = res.data;
            }

            await logApiCall({
                trackingNumber: tn, provider: this.name, requestUrl: 'API-BATCH-GET', requestMethod: 'V4',
                requestPayload: batchPayload, responseStatus: 200, responsePayload: trackingData
            });

            return this._normalize(trackingData, tn);
        } catch (err) {
            const errorData = err.response?.data;
            console.error(`[TrackingMore] lifecycle failed for ${trackingNumber}:`, JSON.stringify(errorData || err.message));

            await logApiCall({
                trackingNumber, provider: this.name, requestUrl: 'API', requestMethod: 'POST/GET',
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
            carrier: item.courier_code || carrierName,
            delivery_status,
            events
        };
    }
}

module.exports = TrackingMoreProvider;
