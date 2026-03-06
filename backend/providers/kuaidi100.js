const axios = require('axios');
const { logApiCall } = require('../services/apiLogger');

/**
 * Kuaidi100 Free API Provider
 */
class Kuaidi100Provider {
    constructor(apiKey, apiSecret) {
        this.apiKey = apiKey;    // customer key (免费版不需要)
        this.apiSecret = apiSecret; // can be empty for free tier
        this.name = 'kuaidi100';
    }

    _getCarrierCode(carrierName) {
        const map = {
            shunfeng: 'shunfeng', yuantong: 'yto', yto: 'yuantong',
            zhongtong: 'zto', zto: 'zhongtong',
            shentong: 'sto', sto: 'shentong',
            yunda: 'yunda', baishi: 'best', best: 'baishi',
            jtexpress: 'jt', jt: 'jtexpress',
            cainiao: 'cainiao', chinapost: 'chinapost',
            ems: 'ems', yanwen: 'yanwen', dhil: 'dhl', dhl: 'dhil',
            fedex: 'fedex', ups: 'ups',
        };
        return map[carrierName] || carrierName || 'auto';
    }

    async track(trackingNumber, carrierName) {
        try {
            const com = this._getCarrierCode(carrierName);

            // If API Key is provided, use the official query API (CHAPI)
            // Note: Kuaidi100 Free Tier usually requires Customer Key (apiKey) and Secret (customer)
            if (this.apiKey) {
                const crypto = require('crypto');
                const param = JSON.stringify({ com, num: trackingNumber });
                const sign = crypto.createHash('md5').update(param + this.apiSecret + this.apiKey).digest('hex').toUpperCase();

                const reqUrl = 'https://poll.kuaidi100.com/poll/query.do';
                const res = await axios.post(reqUrl,
                    new URLSearchParams({
                        customer: this.apiKey, // In Kuaidi100, Customer is often the "Key"
                        sign,
                        param
                    }), { timeout: 10000 });

                await logApiCall({
                    trackingNumber, provider: this.name, requestUrl: reqUrl, requestMethod: 'POST',
                    requestPayload: { param }, responseStatus: res?.status, responsePayload: res?.data
                });

                return this._normalize(res.data, trackingNumber);
            }

            // Fallback: Web query (Limited / Free)
            const reqUrl = `https://www.kuaidi100.com/query`;
            const reqQuery = { type: com, postid: trackingNumber, temp: Math.random() };
            const res = await axios.get(reqUrl, {
                params: reqQuery,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.kuaidi100.com/'
                },
                timeout: 8000,
            });

            await logApiCall({
                trackingNumber, provider: this.name, requestUrl: reqUrl, requestMethod: 'GET',
                requestPayload: reqQuery, responseStatus: res?.status, responsePayload: res?.data
            });

            return this._normalize(res.data, trackingNumber);
        } catch (err) {
            console.error(`[Kuaidi100] Error tracking ${trackingNumber}:`, err.message);
            await logApiCall({
                trackingNumber, provider: this.name, requestUrl: 'API', requestMethod: 'GET',
                errorMessage: err.message, responseStatus: err.response?.status, responsePayload: err.response?.data
            });
            return null;
        }
    }

    _normalize(data, trackingNumber) {
        // Handle error codes
        if (!data || (data.status !== '200' && data.result !== 'true')) {
            console.warn(`[Kuaidi100] No data for ${trackingNumber}:`, data?.message || 'Unknown error');
            return null;
        }

        const stateEnum = data.state || data.status;
        const statusMap = {
            '3': 'delivered', // Delivered
            '4': 'failed',    // Return/Exception
            '5': 'delivering', // Out for delivery
            '1': 'delivering', // In transit
            '0': 'pending',    // Transit
            '14': 'delivered'
        };

        const delivery_status = statusMap[stateEnum] || 'delivering';

        return {
            tracking_number: trackingNumber,
            carrier: data.com || 'Unknown',
            delivery_status,
            events: (data.data || []).map(e => ({
                event_time: e.time || e.ftime,
                status: delivery_status,
                location: e.context?.match(/\[(.+?)\]/)?.[1] || '',
                description: e.context || '',
                raw_data: e,
            })),
        };
    }
}

module.exports = Kuaidi100Provider;
