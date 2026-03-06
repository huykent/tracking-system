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
            // JT Express
            jt: 'jt-express', jtexpress: 'jt-express',
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
            ups: 'ups',
            fedex: 'fedex',
            dhl: 'dhl',
            // JD Logistics
            jd: 'jd-logistics', jdexpress: 'jd-logistics', jdlogistics: 'jd-logistics',
            // YunExpress
            yunexpress: 'yunexpress',
            // USPS
            usps: 'usps',
        };

        const code = map[key];
        if (!code) {
            console.warn(`[TrackingMore] Unknown carrier: "${carrierName}" (key: "${key}") — will let TrackingMore auto-detect`);
        }
        return code || null;
    }

    async track(trackingNumber, carrierName) {
        try {
            const courierCode = this._getCarrierCode(carrierName);

            // Step 1: Create tracking (omit courier_code if unknown — let TM auto-detect)
            const createPayload = { tracking_number: trackingNumber };
            if (courierCode) createPayload.courier_code = courierCode;

            await axios.post(
                'https://api.trackingmore.com/v4/trackings/create',
                createPayload,
                { headers: this._headers(), timeout: 10000 }
            ).catch(e => {
                // Code 4016 = already exists — that's fine
                if (e.response?.data?.meta?.code !== 4016) {
                    console.warn(`[TrackingMore] Create warning for ${trackingNumber}:`, e.response?.data?.meta?.message || e.message);
                }
            });

            // Step 2: Get tracking info — only tracking_number needed, courier already stored by TrackingMore
            const reqUrl = `https://api.trackingmore.com/v4/trackings/get?tracking_number=${trackingNumber}`;

            const res = await axios.get(reqUrl, {
                headers: this._headers(),
                timeout: 10000
            });

            await logApiCall({
                trackingNumber, provider: this.name, requestUrl: reqUrl, requestMethod: 'GET',
                requestPayload: createPayload, responseStatus: res?.status, responsePayload: res?.data
            });

            return this._normalize(res.data, trackingNumber);
        } catch (err) {
            console.error(`[TrackingMore] Error tracking ${trackingNumber}:`, err.response?.data || err.message);
            await logApiCall({
                trackingNumber, provider: this.name, requestUrl: 'API', requestMethod: 'GET',
                errorMessage: err.message, responseStatus: err.response?.status, responsePayload: err.response?.data
            });
            return null;
        }
    }

    _normalize(data, trackingNumber) {
        const item = data?.data?.[0] || data?.data;
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
