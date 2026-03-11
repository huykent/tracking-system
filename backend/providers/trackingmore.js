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
            // Return first suggested courier code
            return res.data?.data?.[0]?.courier_code || null;
        } catch (err) {
            console.warn(`[TrackingMore] Detection failed for ${trackingNumber}:`, err.message);
            return null;
        }
    }

    async track(trackingNumber, carrierName) {
        try {
            // 1. Detect Carrier (Step 1)
            let courierCode = this._getCarrierCode(carrierName);
            if (!courierCode) {
                console.log(`[TrackingMore] Step 1: Detecting carrier for ${trackingNumber}...`);
                courierCode = await this.detectCourier(trackingNumber);
            }

            if (!courierCode) {
                console.warn(`[TrackingMore] Could not detect courier for ${trackingNumber}, will attempt auto-detect create`);
            }

            // 2. Create Tracking (Step 2)
            const createPayload = {
                tracking_number: trackingNumber,
                courier_code: courierCode || undefined
            };

            console.log(`[TrackingMore] Step 2: Syncing tracking for ${trackingNumber}...`);

            let trackingData = null;
            try {
                const createRes = await axios.post(
                    'https://api.trackingmore.com/v4/trackings/create',
                    createPayload,
                    { headers: this._headers(), timeout: 10000 }
                );
                // TM v4 /create returns 200 and data if successful
                if (createRes.data?.meta?.code === 200) {
                    trackingData = createRes.data;
                    console.log(`[TrackingMore] Create successful for ${trackingNumber}`);
                }
            } catch (e) {
                const meta = e.response?.data?.meta;
                // 4101 = Tracking already exists
                if (meta?.code === 4101) {
                    console.log(`[TrackingMore] ${trackingNumber} already exists, getting info...`);
                } else {
                    console.warn(`[TrackingMore] Create error:`, meta?.message || e.message);
                }
            }

            // 3. Get Tracking Info (Step 3)
            // Use RESTful path: /v4/trackings/{courier_code}/{tracking_number}
            if (!trackingData || !this._extractItem(trackingData, trackingNumber)?.origin_info) {
                if (!courierCode) {
                    // If we still don't have a courier code, we must try to detect it or use bulk get
                    courierCode = await this.detectCourier(trackingNumber);
                }

                let reqUrl;
                if (courierCode) {
                    // Official REST path for single tracking
                    reqUrl = `https://api.trackingmore.com/v4/trackings/${courierCode}/${trackingNumber}`;
                } else {
                    // Fallback to query param plural if courier unknown
                    reqUrl = `https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${trackingNumber}`;
                }

                console.log(`[TrackingMore] Step 3: Fetching status from: ${reqUrl}`);
                const res = await axios.get(reqUrl, {
                    headers: this._headers(),
                    timeout: 10000
                });
                trackingData = res.data;
            }

            await logApiCall({
                trackingNumber, provider: this.name, requestUrl: 'API-Lifecycle', requestMethod: 'POST/GET',
                requestPayload: createPayload, responseStatus: 200, responsePayload: trackingData
            });

            return this._normalize(trackingData, trackingNumber);
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
