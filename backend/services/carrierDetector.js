/**
 * Carrier Auto-Detection Service (Legacy)
 * Now purely returns 'unknown' to force API-based detection as requested.
 */

const CARRIER_KEYS = {
    'unknown': 0,
};

function detectCarrier(trackingNumber) {
    return { name: 'unknown', label: 'Unknown', carrierKey: 0 };
}

function getCarrierInfo(name, labelOverride) {
    return {
        name: 'unknown',
        label: labelOverride || 'Unknown',
        carrierKey: 0,
    };
}

module.exports = { detectCarrier, CARRIER_KEYS, getCarrierInfo };

