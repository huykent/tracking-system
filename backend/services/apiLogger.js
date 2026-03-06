const { query } = require('../db');

/**
 * Log API requests for debugging Administrative Panel
 */
async function logApiCall({ trackingNumber, provider, requestUrl, requestMethod, requestPayload, responseStatus, responsePayload, errorMessage }) {
    try {
        // Check if debug mode is enabled
        const { rows } = await query("SELECT value FROM settings WHERE key = 'debug_mode'");
        if (!rows.length || rows[0].value !== 'true') return;

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
        console.error('[Logger] Failed to save API log:', err.message);
    }
}

module.exports = { logApiCall };
