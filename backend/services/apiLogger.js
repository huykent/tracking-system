const { query } = require('../db');

// Cache debug mode for 10s to avoid a DB query on every API call
let _debugMode = false;
let _debugModeCheckedAt = 0;

async function isDebugEnabled() {
    const now = Date.now();
    if (now - _debugModeCheckedAt < 10000) return _debugMode; // use cached value
    try {
        const { rows } = await query("SELECT value FROM settings WHERE key = 'debug_mode'");
        _debugMode = rows.length > 0 && rows[0].value === 'true';
        _debugModeCheckedAt = now;
    } catch {
        _debugMode = false;
    }
    return _debugMode;
}

/**
 * Log API requests for debugging Administrative Panel
 */
async function logApiCall({ trackingNumber, provider, requestUrl, requestMethod, requestPayload, responseStatus, responsePayload, errorMessage }) {
    try {
        if (!(await isDebugEnabled())) return;

        await query(
            `INSERT INTO api_logs 
             (tracking_number, provider, request_url, request_method, request_payload, response_status, response_payload, error_message) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                trackingNumber || 'Unknown',
                provider,
                requestUrl,
                requestMethod,
                requestPayload ? JSON.stringify(requestPayload) : null,
                responseStatus || null,
                responsePayload ? JSON.stringify(responsePayload) : null,
                errorMessage || null
            ]
        );
    } catch (err) {
        // Don't crash the main flow — table might not exist yet on first boot
        if (!err.message?.includes('does not exist')) {
            console.error('[Logger] Failed to save API log:', err.message);
        }
    }
}

function invalidateCache() {
    _debugModeCheckedAt = 0;
}

module.exports = { logApiCall, invalidateCache };
