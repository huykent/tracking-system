const axios = require('axios');

const REGISTER_URL = 'https://api.17track.net/track/v2.2/register';
const GETINFO_URL = 'https://api.17track.net/track/v2.2/gettrackinfo';

/**
 * 17Track Provider
 */
class Track17Provider {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.name = '17track';
    }

    _headers() {
        return {
            '17token': this.apiKey,
            'Content-Type': 'application/json',
        };
    }

    async track(trackingNumber, carrier, carrierKey = 0) {
        try {
            const payload = [{ number: trackingNumber, carrier: carrierKey || undefined }];

            // Step 1: Register
            const regRes = await axios.post(REGISTER_URL, payload, {
                headers: this._headers(), timeout: 10000,
            }).catch(e => {
                console.warn(`[17Track] Register warning for ${trackingNumber}:`, e?.response?.data?.message || e.message);
                return null;
            });

            if (regRes?.data?.data?.rejected?.length > 0) {
                console.warn('[17Track] Rejected:', regRes.data.data.rejected);
            }

            // Step 2: Get tracking info
            const infoRes = await axios.post(GETINFO_URL, payload, {
                headers: this._headers(), timeout: 15000,
            });

            return this._normalize(infoRes.data, trackingNumber);
        } catch (err) {
            console.error(`[17Track] Error tracking ${trackingNumber}:`, err.message);
            return null;
        }
    }

    _normalize(data, trackingNumber) {
        const accepted = data?.data?.accepted;
        if (!accepted || accepted.length === 0) return null;

        const item = accepted[0];
        const trackInfo = item.track || {};

        // Status enum: 0=NotFound, 10=Transit, 20=Expired, 30=Pickup, 40=Delivered, 50=Undelivered, 60=Alert
        const statusEnum = trackInfo.e || 0;
        let delivery_status = 'pending';
        if (statusEnum === 40) delivery_status = 'delivered';
        else if (statusEnum === 30 || statusEnum === 10) delivery_status = 'delivering';
        else if (statusEnum >= 50) delivery_status = 'failed';
        else if (statusEnum > 0) delivery_status = 'delivering';

        const rawEvents = [...(trackInfo.z0 || []), ...(trackInfo.z1 || []), ...(trackInfo.z2 || [])];
        rawEvents.sort((a, b) => new Date(b.a) - new Date(a.a));

        return {
            tracking_number: trackingNumber,
            carrier: item.e?.toString() || 'Unknown',
            delivery_status,
            events: rawEvents.map(e => ({
                event_time: e.a,
                status: delivery_status,
                location: e.c || '',
                description: e.z || e.d || '',
                raw_data: e,
            })),
        };
    }
}

module.exports = Track17Provider;
