const db = require('./db');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

let carrierDb = {};
let isDbLoaded = false;

// Hàm load CSV vào memory
async function loadCarrierDb() {
    if (isDbLoaded) return;
    const csvPath = path.join(__dirname, '..', 'carriers.csv');
    if (!fs.existsSync(csvPath)) {
        console.warn('[Tracking] carriers.csv not found at', csvPath);
        return;
    }

    return new Promise((resolve) => {
        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (row) => {
                // row: { key, name_en, name_cn, name_hk, url }
                const key = row.key;
                if (key) {
                    carrierDb[key] = row;
                    // Map thêm alias để search
                    carrierDb[row.name_en?.toLowerCase()] = key;
                    if (row.name_cn) carrierDb[row.name_cn] = key;
                }
            })
            .on('end', () => {
                console.log(`[Tracking] Loaded ${Object.keys(carrierDb).length} carrier entries from CSV.`);
                isDbLoaded = true;
                resolve();
            });
    });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function geocodeLocation(locationText) {
    if (!locationText || locationText.length < 3) return { lat: null, lon: null };

    let query = locationText.replace(/Hub|Warehouse|Distribution|Center|Airport|Sorting/gi, '').trim();
    if (query.includes('-')) query = query.split('-')[0].trim();
    if (query.includes(',')) query = query.split(',').slice(-2).join(',').trim(); // Take mainly country/city

    try {
        await sleep(1000); // openstreetmap limit 1 req/s
        const res = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
            headers: { 'User-Agent': 'SmartTracker_Bot/1.0' }
        });
        if (res.data && res.data.length > 0) {
            return { lat: parseFloat(res.data[0].lat), lon: parseFloat(res.data[0].lon) };
        }
    } catch (err) {
        console.log("Geocoding failed for: ", locationText);
    }
    return { lat: null, lon: null };
}

// Bảng mã hãng vận chuyển theo 17Track carrier_key (Mã ưu tiên hoặc manual override)
const CARRIER_17TRACK_KEYS = {
    'shunfeng': 100012,   // SF Express
    'yunexpress': 190008,   // YunExpress (Updated from CSV)
    'yto': 190157,   // YTO Express (Updated from CSV)
    'zto': 190455,   // ZTO Express (Updated from CSV)
    'sto': 190324,   // STO Express (Updated from CSV)
    'yunda': 190341,   // Yunda Express (Updated from CSV)
    'best': 190259,   // Best Express (Updated from CSV)
    'jt': 191118,   // J&T Express (Global/CN fallback)
    'cainiao': 190271,   // Cainiao
    '4px': 190094,   // 4PX
    'chinapost': 3011,   // China Post
    'ems': 3013,   // China EMS
    'yanwen': 190012,   // Yanwen (Updated from CSV 190012)
    'winit': 190284,
    'wanbexpress': 190086,
    'gdexpress': 100150,
    'ups': 100002,
    'fedex': 100003,
    'dhl': 100001,
    'unknown': 0
};

function detectCarrier(trackingNumber) {
    const tn = trackingNumber.trim().toUpperCase();

    // ─── SF Express (Shun Feng) ─────────────────────────────
    if (/^SF\d{12,15}$/.test(tn)) return 'shunfeng';

    // ─── YunExpress ─────────────────────────────────────────
    if (/^YT\d{16}$/.test(tn)) return 'yunexpress';

    // ─── Yuantong (YTO Express) ──────────────────────────────
    if (/^(YTO|6\d{12}|EN\d{9}CN)$/.test(tn)) return 'yto';

    // ─── ZTO Express ────────────────────────────────────────
    if (/^(ZTO|773|303)\d{9,12}$/.test(tn)) return 'zto';

    // ─── STO Express (Shentong) ──────────────────────────────
    if (/^(STO|A[A-Z]\d{9}CN|\d{12})$/.test(tn) && /^36/.test(tn)) return 'sto';

    // ─── Yunda Express ──────────────────────────────────────
    if (/^(YD\d{16}|\d{13}[A-Z]{2})$/.test(tn)) return 'yunda';

    // ─── BEST Express ────────────────────────────────────────
    if (/^(B[A-Z0-9]{11,14}|BX\d{12})$/.test(tn)) return 'best';

    // ─── J&T Express ────────────────────────────────────────
    if (/^(JT\d{12}|JTE\d{12})$/.test(tn)) return 'jt';

    // ─── Cainiao / AliExpress Standard ───────────────────────
    if (/^(LP\d{18}|LX\d{9}[A-Z]{2}|CNGZ\d+)$/.test(tn)) return 'cainiao';

    // ─── 4PX ─────────────────────────────────────────────────
    if (/^(RE|RR|RP|RQ|RS|RT|RU|RV|RW|RX|RY|RZ)\d{9}CN$/i.test(tn)) return '4px';

    // ─── China Post / ePacket ────────────────────────────────
    if (/^(R|L|V|E|C|U|D)\d{9}CN$/.test(tn)) return 'chinapost';
    if (/^CP\d{9}CN$/.test(tn)) return 'chinapost';

    // ─── EMS China ──────────────────────────────────────────
    if (/^E[A-Z]\d{9}CN$/.test(tn)) return 'ems';

    // ─── Yanwen ──────────────────────────────────────────────
    if (/^(YW|U\d{9}[A-Z]{2})$/.test(tn)) return 'yanwen';
    if (/^MH\d{9}[A-Z]{2}$/.test(tn)) return 'yanwen';

    // ─── Winit ───────────────────────────────────────────────
    if (/^WN[A-Z0-9]{10,14}$/.test(tn)) return 'winit';

    // ─── WanbExpress ─────────────────────────────────────────
    if (/^WANB\d{16}$/.test(tn)) return 'wanbexpress';

    // ─── GD Express (Guodong) ────────────────────────────────
    if (/^(GD|GDE)\d{12,14}$/.test(tn)) return 'gdexpress';

    // ─── Deppon ──────────────────────────────────────────────
    if (/^(D[0-9]{12}|DEP\d{12})$/.test(tn)) return 'deppon';

    // ─── ZJS Express (Zhongjisujun) ──────────────────────────
    if (/^(ZJS\d{10}|DD\d{12})$/.test(tn)) return 'zjs';

    // ─── Generic 10-digit CN ────────────────────────────────
    if (/^[0-9]{10}$/.test(tn)) {
        const prefix = parseInt(tn.substring(0, 2));
        if (prefix >= 75 && prefix <= 79) return 'zto';
        if (prefix >= 60 && prefix <= 69) return 'yto';
    }

    // ─── International ───────────────────────────────────────
    if (/^1Z[A-Z0-9]{16}$/.test(tn)) return 'ups';
    if (/^[0-9]{20}$/.test(tn)) return 'fedex';
    if (/^(JD[0-9]{18}|V[A-Z0-9]{16})$/.test(tn)) return 'jdexpress';
    if (/^(RX|RA)\d{9}[A-Z]{2}$/.test(tn)) return 'royal-mail';
    if (/^[0-9]{34}$/.test(tn)) return 'dhl';
    if (/^\d{22}$/.test(tn)) return 'dhl';

    return 'unknown';
}

// Lấy carrier_key 17Track từ tên hãng (Ưu tiên map cứng, sau đó search DB CSV)
function get17TrackCarrierKey(carrierName) {
    if (!carrierName) return 0;

    // 1. Kiểm tra bảng map cứng
    if (CARRIER_17TRACK_KEYS[carrierName]) return CARRIER_17TRACK_KEYS[carrierName];

    // 2. Tìm trong database CSV (nếu đã load)
    const normalizedName = carrierName.toLowerCase();
    if (carrierDb[normalizedName]) {
        const key = carrierDb[normalizedName];
        return parseInt(key);
    }

    return 0; // 0 = auto-detect
}

// Hàm API thực tế 17Track
async function fetchFrom17TrackAPI(tracking_number, carrier, apiKey) {
    try {
        await loadCarrierDb(); // Đảm bảo DB đã load
        console.log(`[API 17Track] Fetching real tracking data for ${tracking_number}...`);

        // 1. Nhận diện carrier_key nếu có
        const carrierName = carrier || detectCarrier(tracking_number);
        const carrierKey = get17TrackCarrierKey(carrierName);
        const registerPayload = [{ number: tracking_number, carrier: carrierKey || undefined }];
        console.log(`[17Track] Carrier detected: ${carrierName} -> key=${carrierKey}`);

        // 2. Đăng ký mã vận đơn trước (nếu chưa có)
        const regRes = await axios.post(
            'https://api.17track.net/track/v2.2/register',
            registerPayload,
            { headers: { '17token': apiKey, 'Content-Type': 'application/json' } }
        ).catch(e => { console.warn('[17Track register error]', e?.response?.data); });
        if (regRes?.data?.data?.rejected?.length > 0) {
            console.warn('[17Track register rejected]', regRes.data.data.rejected);
        }

        // 3. Lấy thông tin vận đơn
        const res = await axios.post(
            'https://api.17track.net/track/v2.2/gettrackinfo',
            [{ number: tracking_number, carrier: carrierKey || undefined }],
            { headers: { '17token': apiKey, 'Content-Type': 'application/json' } }
        );

        const data = res.data;
        console.log(`[17Track Raw Response] ${tracking_number}:`, JSON.stringify(data).substring(0, 500));
        if (!data || !data.data || !data.data.accepted || data.data.accepted.length === 0) {
            console.log(`[17Track] No accepted data, rejected:`, JSON.stringify(data?.data?.rejected));
            return null;
        }

        const tracking = data.data.accepted[0];
        const trackInfo = tracking.track || {};

        console.log(`[17Track trackInfo keys] e=${trackInfo.e}, z1_len=${trackInfo.z1?.length}, z2_len=${trackInfo.z2?.length}`);

        // Trạng thái (0: NotFound, 10: Transit, 20: Expired, 30: Pickup, 40: Delivered, 50: Undelivered, 60: Alert)
        const statusEnum = trackInfo.e || 0;

        let delivery_status = 'pending';
        if (statusEnum === 40) delivery_status = 'delivered';
        else if (statusEnum === 30 || statusEnum === 10) delivery_status = 'delivering';
        else if (statusEnum >= 50) delivery_status = 'failed';
        else if (statusEnum > 0) delivery_status = 'delivering';

        // z1 = customer-lang events, z2 = provider-lang events
        const eventsArray = trackInfo.z1 || trackInfo.z2 || [];
        const events = eventsArray.map(e => ({
            time: (e.a || new Date().toISOString()).replace('T', ' ').substring(0, 19),
            status: e.z || e.x || 'Update',
            location: e.c || e.l || '',
            raw_data: null
        }));

        let detected_carrier = null;
        if (tracking.carrier) {
            // w1 = carrier number/name, try different fields
            detected_carrier = tracking.carrier?.w1 || tracking.carrier?.carrier_key || null;
            if (typeof detected_carrier !== 'string') detected_carrier = detected_carrier?.toString() || null;
        }

        return { delivery_status, events, detected_carrier };
    } catch (err) {
        console.error(`17Track API Error for ${tracking_number}:`, err?.response?.data || err.message);
        return {
            delivery_status: 'failed',
            events: [{ time: new Date().toISOString().replace('T', ' ').substring(0, 19), status: '17Track API Error', location: 'System API', raw_data: JSON.stringify(err?.response?.data || { message: err.message }) }],
            detected_carrier: null
        };
    }
}

// Hàm fetch chung
async function fetchFromCarrierAPI(tracking_number, carrier) {
    let ship24ApiKey = null;
    let track17ApiKey = null;
    let apiProvider = 'ship24';

    try {
        const result = await db.query("SELECT key, value FROM settings WHERE key IN ('ship24Key', '17trackKey', 'apiProvider')");
        result.rows.forEach(row => {
            if (row.key === 'ship24Key') ship24ApiKey = row.value;
            if (row.key === '17trackKey') track17ApiKey = row.value;
            if (row.key === 'apiProvider') apiProvider = row.value;
        });
    } catch { }

    if (apiProvider === '17track' && track17ApiKey) {
        return await fetchFrom17TrackAPI(tracking_number, carrier, track17ApiKey);
    }

    // Nếu chưa điền Key hoặc vẫn dùng test mock mặc định
    if (!ship24ApiKey) {
        console.log(`[API Mock] Missing Ship24 Key, mocking for ${tracking_number}...`);
        await new Promise(r => setTimeout(r, 800));

        if (tracking_number === 'YT7606214964729') {
            return {
                delivery_status: 'delivered',
                events: [
                    { time: '2024-03-01 10:20:00', status: 'Picked up', location: 'Shenzhen Warehouse, China', raw_data: null },
                    { time: '2024-03-02 14:15:30', status: 'Sorting center', location: 'Guangzhou Hub, China', raw_data: null },
                    { time: '2024-03-03 08:45:00', status: 'Flight Departed', location: 'Guangzhou Baiyun Airport', raw_data: null },
                    { time: '2024-03-04 15:30:20', status: 'Arrived at destination country', location: 'Noi Bai Airport, Hanoi', raw_data: null },
                    { time: '2024-03-05 09:10:00', status: 'Out for delivery', location: 'Ba Dinh District Hub, Hanoi', raw_data: null },
                    {
                        time: '2024-03-05 16:40:00',
                        status: 'Delivered',
                        location: 'Recipient Address - Signed by: Nguyen Van A',
                        raw_data: JSON.stringify({ proof_url: 'https://images.unsplash.com/photo-1620062779636-22441def6217?auto=format&fit=crop&q=80&w=400' })
                    }
                ]
            };
        }
        return {
            delivery_status: 'delivering',
            events: [{ time: new Date().toISOString().replace('T', ' ').substring(0, 19), status: 'Data Received', location: 'Carrier System', raw_data: null }]
        };
    }

    try {
        console.log(`[API Ship24] Fetching real tracking data for ${tracking_number}...`);
        const res = await axios.post(
            'https://api.ship24.com/public/v1/trackers/track',
            { trackingNumber: tracking_number },
            {
                headers: {
                    'Authorization': `Bearer ${ship24ApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = res.data;
        if (!data || !data.data || !data.data.trackings || data.data.trackings.length === 0) return null;

        const tracking = data.data.trackings[0];

        let delivery_status = 'pending';
        const ship24Status = tracking.shipment?.statusMilestone || tracking.shipment?.statusCode || '';
        if (ship24Status.toLowerCase() === 'delivered') delivery_status = 'delivered';
        else if (ship24Status.toLowerCase() === 'out_for_delivery') delivery_status = 'delivering';
        else if (ship24Status.toLowerCase() === 'exception' || ship24Status.toLowerCase() === 'failed_attempt') delivery_status = 'failed';
        else if (ship24Status) delivery_status = 'delivering';

        let detected_carrier = null;
        if (tracking.tracker && tracking.tracker.courierCode && tracking.tracker.courierCode.length > 0) {
            detected_carrier = tracking.tracker.courierCode[0];
        } else if (tracking.events && tracking.events.length > 0 && tracking.events[0].courierCode) {
            detected_carrier = tracking.events[0].courierCode;
        }

        const events = (tracking.events || []).map(e => ({
            time: (e.occurrenceDatetime || new Date().toISOString()).replace('T', ' ').substring(0, 19),
            status: e.status || e.statusMilestone || 'Update',
            location: e.location || '',
            raw_data: null
        }));

        return { delivery_status, events, detected_carrier };
    } catch (err) {
        console.error(`Ship24 API Error for ${tracking_number}:`, err?.response?.data || err.message);
        return {
            delivery_status: 'failed',
            events: [{ time: new Date().toISOString().replace('T', ' ').substring(0, 19), status: 'Tracking Error / Not Found', location: 'System API', raw_data: JSON.stringify(err?.response?.data || { message: err.message }) }],
            detected_carrier: null
        };
    }
}

async function processShipment(shipment) {
    let { tracking_number, carrier } = shipment;

    if (!carrier || carrier === 'unknown') {
        carrier = detectCarrier(tracking_number);
        await db.run('UPDATE shipments SET carrier = ? WHERE tracking_number = ?', [carrier, tracking_number]);
    }

    // 1. Gọi API lấy dữ liệu chi tiết từ bên vận chuyển
    const apiResponse = await fetchFromCarrierAPI(tracking_number, carrier);
    if (!apiResponse || !apiResponse.events) return null;

    if (apiResponse.detected_carrier && apiResponse.detected_carrier !== carrier && (carrier === 'unknown' || carrier === detectCarrier(tracking_number))) {
        carrier = apiResponse.detected_carrier;
        await db.run('UPDATE shipments SET carrier = ? WHERE tracking_number = ?', [carrier, tracking_number]);
    }

    let hasNewUpdates = false;

    // 2. Mapping sự kiện và không dùng datetime('now') của hệ thống, sử dụng thời gian thực từ hãng
    for (const evt of apiResponse.events) {
        // Kiểm tra xem event này đã tồn tại trong DB chưa (dựa vào tracking_number và thời gian event)
        const exists = await db.query(
            'SELECT id FROM tracking_events WHERE tracking_number = ? AND event_time = ? AND status = ?',
            [tracking_number, evt.time, evt.status]
        );

        // NẾU CHƯA CÓ -> INSERT
        if (exists.rows.length === 0) {
            hasNewUpdates = true;
            let { lat, lon } = await geocodeLocation(evt.location);

            await db.run(
                "INSERT INTO tracking_events (tracking_number, event_time, status, location, latitude, longitude, raw_data) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [tracking_number, evt.time, evt.status, evt.location, lat, lon, evt.raw_data]
            );
        }
    }

    // 3. Nếu có cập nhật mới, update lại status cho kiện hàng
    if (hasNewUpdates) {
        await db.run(
            "UPDATE shipments SET delivery_status = ?, last_tracking_update = datetime('now') WHERE tracking_number = ?",
            [apiResponse.delivery_status, tracking_number]
        );
        console.log(`[UPDATED] tracking ${tracking_number} to ${apiResponse.delivery_status}`);
    } else {
        console.log(`[NO CHANGES] for ${tracking_number}`);
    }

    return apiResponse;
}

module.exports = {
    detectCarrier,
    processShipment
};
