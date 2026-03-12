const axios = require('axios');
const { logApiCall } = require('../services/apiLogger');

/**
 * TrackingMore Provider (v4 API)
 */
class TrackingMoreProvider {
    constructor(apiKey) {
        try {
            this.apiKeys = JSON.parse(apiKey);
            if (!Array.isArray(this.apiKeys)) throw new Error('Not array');
        } catch (e) {
            const parts = (apiKey || '').split(',').map(k => k.trim()).filter(Boolean);
            this.apiKeys = parts.map(k => ({ key: k, used: 0, limit: 50, month: new Date().getMonth() }));
        }
        this.name = 'trackingmore';
    }

    _getAvailableKeyObj() {
        if (this.apiKeys.length === 0) return null;

        const currentMonth = new Date().getMonth();
        let fallback = this.apiKeys[0];

        for (const k of this.apiKeys) {
            if (k.month !== currentMonth) {
                k.used = 0;
                k.month = currentMonth;
            }
            if (k.used < k.limit) {
                return k;
            }
        }
        return fallback; // Return first one even if over limit as fallback
    }

    async _incrementUsage(keyObj) {
        if (!keyObj) return;
        keyObj.used += 1;
        try {
            const { query } = require('../db');
            await query(`UPDATE api_providers SET api_key = $1 WHERE name = 'trackingmore'`, [JSON.stringify(this.apiKeys)]);
        } catch (e) {
            console.error('[TrackingMore] Failed to update key usage in DB:', e.message);
        }
    }

    /**
     * Internal headers for TrackingMore v4
     */
    _headers(keyStr) {
        return {
            'Tracking-Api-Key': keyStr || '',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
    }

    /**
     * Rely ENTIRELY on API detection as requested.
     * We no longer trust or use the carrier name stored in DB for TrackingMore.
     */
    _getCarrierCode(carrierName) {
        return null;
    }

    async detectCourier(trackingNumber, keyStr) {
        try {
            const tn = String(trackingNumber).trim().toUpperCase();
            console.log(`[TrackingMore] Detecting ${tn}...`);

            const res = await axios({
                method: 'POST',
                url: 'https://api.trackingmore.com/v4/couriers/detect',
                headers: this._headers(keyStr),
                data: { tracking_number: tn },
                timeout: 10000
            });

            const couriers = res.data?.data || [];
            if (couriers.length === 0) {
                console.log(`[TrackingMore] No couriers detected for ${tn}`);
                return null;
            }

            console.log(`[TrackingMore] Candidates for ${tn}:`, couriers.map(c => c.courier_code).join(', '));

            let selected = couriers[0];

            // YT numbers priority (mostly YTO or YunExpress)
            if (tn.startsWith('YT')) {
                const preference = ['yto', 'yunexpress'];
                const match = couriers.find(c => preference.includes(c.courier_code.toLowerCase()));
                if (match) {
                    console.log(`[TrackingMore] Preferring ${match.courier_code} over ${selected.courier_code}`);
                    selected = match;
                }
            } else if (tn.startsWith('JDK')) {
                const match = couriers.find(c => c.courier_code.toLowerCase().includes('jd'));
                if (match) selected = match;
            }

            console.log(`[TrackingMore] Selected: ${selected.courier_code} (${selected.courier_name})`);

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
        const keyObj = this._getAvailableKeyObj();
        const keyStr = keyObj ? keyObj.key : '';

        try {
            // Force re-detection every time for maximum accuracy
            const detectedData = await this.detectCourier(tn, keyStr);
            const courierCode = detectedData?.courier_code || null;

            // 2. Sync to TM
            let trackingData = null;
            const payload = { tracking_number: tn };
            if (courierCode) payload.courier_code = courierCode;

            try {
                const res = await axios({
                    method: 'POST',
                    url: 'https://api.trackingmore.com/v4/trackings/create',
                    headers: this._headers(keyStr),
                    data: payload, // Axios will stringify this correctly
                    timeout: 10000
                });
                // v4 returns 200 on success, 4101 if exists
                if (res.data?.meta?.code === 200 || res.data?.meta?.code === 4101) {
                    trackingData = res.data;
                    if (res.data?.meta?.code === 200) {
                        // Only increment tracking limit usage on successful NEW creation
                        await this._incrementUsage(keyObj);
                    }
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
                    headers: this._headers(keyStr),
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
