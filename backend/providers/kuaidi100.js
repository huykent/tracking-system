const axios = require('axios');

/**
 * Kuaidi100 Free API Provider
 */
class Kuaidi100Provider {
    constructor(apiKey, apiSecret) {
        this.apiKey = apiKey;    // customer key (免费版不需要)
        this.apiSecret = apiSecret; // can be empty for free tier
        this.name = 'kuaidi100';
    }

    // Map our carrier name to Kuaidi100 carrier code
    _getCarrierCode(carrierName) {
        const map = {
            shunfeng: 'shunfeng', yto: 'yuantong', zto: 'zhongtong',
            sto: 'shentong', yunda: 'yunda', best: 'baishi',
            jt: 'jtexpress', cainiao: 'cainiao', chinapost: 'chinapost',
            ems: 'ems', yanwen: 'yanwen', dhl: 'dhil', fedex: 'fedex', ups: 'ups',
        };
        return map[carrierName] || 'auto';
    }

    async track(trackingNumber, carrierName) {
        try {
            const com = this._getCarrierCode(carrierName);
            // Free tier endpoint (limited, no auth needed)
            const res = await axios.get(`https://www.kuaidi100.com/query`, {
                params: { type: com, postid: trackingNumber },
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 8000,
            });

            return this._normalize(res.data, trackingNumber);
        } catch (err) {
            console.error(`[Kuaidi100] Error tracking ${trackingNumber}:`, err.message);
            return null;
        }
    }

    _normalize(data, trackingNumber) {
        if (!data || data.status !== '200' || !data.data) return null;

        const statusMap = { '200': 'delivered', '3': 'delivering', '1': 'pending' };
        const delivery_status = statusMap[data.state] || 'delivering';

        return {
            tracking_number: trackingNumber,
            carrier: data.com || 'Unknown',
            delivery_status,
            events: (data.data || []).map(e => ({
                event_time: e.time,
                status: delivery_status,
                location: e.context?.match(/\[(.+?)\]/)?.[1] || '',
                description: e.context || '',
                raw_data: e,
            })),
        };
    }
}

module.exports = Kuaidi100Provider;
