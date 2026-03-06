/**
 * Carrier Auto-Detection Service
 * Detects shipping carrier from tracking number prefix/pattern
 */

// ─── 17Track Carrier Key Map ──────────────────────────────
const CARRIER_KEYS = {
    'shunfeng': 100012,
    'yunexpress': 190008,
    'yto': 190157,
    'zto': 190455,
    'sto': 190324,
    'yunda': 190341,
    'best': 190259,
    'jt': 190442,
    'cainiao': 190271,
    '4px': 190094,
    'chinapost': 3011,
    'ems': 3013,
    'yanwen': 190012,
    'winit': 190284,
    'dhl': 100001,
    'fedex': 100003,
    'ups': 100002,
    'unknown': 0,
};

// ─── Carrier Detection Rules (priority order) ─────────────
const CARRIER_RULES = [
    // SF Express (Shunfeng)
    { name: 'shunfeng', label: 'SF Express', regex: /^SF\d{12,15}$/i },

    // YunExpress (云途)
    { name: 'yunexpress', label: 'YunExpress', regex: /^YT\d{16}$/ },

    // YTO Express (圆通)
    { name: 'yto', label: 'YTO Express', regex: /^(YT[^0]\d{14}|EN\d{9}CN)$/i },

    // ZTO Express (中通)
    { name: 'zto', label: 'ZTO Express', regex: /^(ZT0|773\d{9,12}|303\d{9,12})$/ },

    // STO Express (申通)
    { name: 'sto', label: 'STO Express', regex: /^(STO\d+|36\d{10})$/i },

    // Yunda Express (韵达)
    { name: 'yunda', label: 'Yunda Express', regex: /^(YD\d{16})$/ },

    // BEST Express (百世)
    { name: 'best', label: 'BEST Express', regex: /^BX\d{12}$/ },

    // J&T Express
    { name: 'jt', label: 'J&T Express', regex: /^JT[E]?\d{12}$/ },

    // Cainiao (菜鸟)
    { name: 'cainiao', label: 'Cainiao', regex: /^(LP\d{18}|LX\d{9}[A-Z]{2}|CNGZ\d+)$/i },

    // 4PX
    { name: '4px', label: '4PX', regex: /^(RE|RR|RP|RQ|RS|RT|RU)\d{9}CN$/i },

    // China Post / ePacket (multiple letter prefixes)
    { name: 'chinapost', label: 'China Post', regex: /^(R|L|V|C|U|D|CP)\d{9}CN$/i },

    // China EMS
    { name: 'ems', label: 'China EMS', regex: /^E[A-Z]\d{9}CN$/i },

    // Yanwen (燕文)
    { name: 'yanwen', label: 'Yanwen', regex: /^(MH|YW)\d{9}[A-Z]{2}$/i },

    // Winit (万邑通)
    { name: 'winit', label: 'Winit', regex: /^WN[A-Z0-9]{10,14}$/i },

    // WANB Express
    { name: 'winit', label: 'WANB Express', regex: /^WANB\d{16}$/i },

    // UPS
    { name: 'ups', label: 'UPS', regex: /^1Z[A-Z0-9]{16}$/ },

    // FedEx (20 digits)
    { name: 'fedex', label: 'FedEx', regex: /^\d{20}$/ },

    // DHL (34 or 22 digits)
    { name: 'dhl', label: 'DHL Express', regex: /^(\d{34}|\d{22})$/ },

    // JD Express (京东)
    { name: 'jdexpress', label: 'JD Express', regex: /^JD\d{18}$/ },

    // Generic 10-digit by prefix
    {
        name: '_generic10', label: null, regex: /^\d{10}$/, handler: (tn) => {
            const p = parseInt(tn.substring(0, 2));
            if (p >= 75 && p <= 79) return 'zto';
            if (p >= 60 && p <= 69) return 'yto';
            return 'unknown';
        }
    },
];

/**
 * Detect carrier from tracking number
 * @param {string} trackingNumber
 * @returns {{ name: string, label: string, carrierKey: number }}
 */
function detectCarrier(trackingNumber) {
    if (!trackingNumber) return { name: 'unknown', label: 'Unknown', carrierKey: 0 };

    const tn = trackingNumber.trim().toUpperCase();

    for (const rule of CARRIER_RULES) {
        if (rule.regex.test(tn)) {
            if (rule.handler) {
                const resolved = rule.handler(tn);
                return getCarrierInfo(resolved);
            }
            return getCarrierInfo(rule.name, rule.label);
        }
    }

    return { name: 'unknown', label: 'Unknown', carrierKey: 0 };
}

function getCarrierInfo(name, labelOverride) {
    const key = CARRIER_KEYS[name] || 0;
    const labels = {
        shunfeng: 'SF Express', yunexpress: 'YunExpress', yto: 'YTO Express',
        zto: 'ZTO Express', sto: 'STO Express', yunda: 'Yunda', best: 'BEST Express',
        jt: 'J&T Express', cainiao: 'Cainiao', '4px': '4PX', chinapost: 'China Post',
        ems: 'China EMS', yanwen: 'Yanwen', winit: 'Winit',
        dhl: 'DHL Express', fedex: 'FedEx', ups: 'UPS',
        jdexpress: 'JD Express', unknown: 'Unknown',
    };
    return {
        name,
        label: labelOverride || labels[name] || name,
        carrierKey: key,
    };
}

module.exports = { detectCarrier, CARRIER_KEYS, getCarrierInfo };
