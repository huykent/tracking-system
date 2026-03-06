const axios = require('axios');

/**
 * TrackingMore Provider
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
     * Map internal carrier names to TrackingMore courier_code
     */
    _getCarrierCode(carrierName) {
        const map = {
            shunfeng: 'sf-express',
            yunexpress: 'yunexpress',
            yto: 'yto-express',
            zto: 'zto-express',
            sto: 'sto-express',
            yunda: 'yunda-express',
            best: 'best-express',
            jt: 'jt-express',
            cainiao: 'cainiao',
            '4px': '4px',
            chinapost: 'china-post',
            ems: 'china-ems',
            yanwen: 'yanwen',
            ups: 'ups',
            fedex: 'fedex',
            dhl: 'dhl',
            jdexpress: 'jd-logistics',
        };
        return map[carrierName] || carrierName;
    }

    async track(trackingNumber, carrierName) {
        try {
            const courierCode = this._getCarrierCode(carrierName);

            // Step 1: Create tracking (if not exists)
            // TrackingMore often requires a POST to create before GETting info
            await axios.post('https://api.trackingmore.com/v4/trackings/create', {
                tracking_number: trackingNumber,
                courier_code: courierCode
            }, {
                headers: this._headers(),
                timeout: 10000
            }).catch(e => {
                // If it already exists (4016), that's fine
                if (e.response?.data?.meta?.code !== 4016) {
                    console.warn(`[TrackingMore] Create warning for ${trackingNumber}:`, e.response?.data?.meta?.message || e.message);
                }
            });

            // Step 2: Get tracking info
            const res = await axios.get(`https://api.trackingmore.com/v4/trackings/get?tracking_number=${trackingNumber}&courier_code=${courierCode}`, {
                headers: this._headers(),
                timeout: 10000
            });

            return this._normalize(res.data, trackingNumber);
        } catch (err) {
            console.error(`[TrackingMore] Error tracking ${trackingNumber}:`, err.response?.data || err.message);
            return null;
        }
    }

    _normalize(data, trackingNumber) {
        const item = data?.data?.[0] || data?.data; // TrackingMore returns array in batch/get
        if (!item) return null;

        /**
         * Status mapping:
         * pending, info_received, in_transit, picking, out_for_delivery, 
         * delivered, expired, failed_attempt, exception, returning, returned
         */
        let delivery_status = 'pending';
        const tmStatus = item.delivery_status;

        if (tmStatus === 'delivered') delivery_status = 'delivered';
        else if (['in_transit', 'picking', 'out_for_delivery'].includes(tmStatus)) delivery_status = 'delivering';
        else if (['failed_attempt', 'exception'].includes(tmStatus)) delivery_status = 'failed';
        else if (tmStatus === 'pending') delivery_status = 'pending';
        else if (tmStatus) delivery_status = 'delivering';

        // Extract events from origin_info and destination_info
        const events = [];
        const trackinfo = item.origin_info?.trackinfo || item.destination_info?.trackinfo || [];

        trackinfo.forEach(e => {
            events.push({
                event_time: e.checkpoint_date,
                status: e.status_description || e.checkpoint_delivery_status,
                location: e.location || e.city || '',
                description: e.details || e.status_description,
                raw_data: e
            });
        });

        // Sort by time descending
        events.sort((a, b) => new Date(b.event_time) - new Date(a.event_time));

        return {
            tracking_number: trackingNumber,
            carrier: item.courier_code,
            delivery_status,
            events: events
        };
    }
}

module.exports = TrackingMoreProvider;
