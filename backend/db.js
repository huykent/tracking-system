const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://tracking_user:tracking_pass@localhost:5432/tracking_db',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client:', err.message);
});

pool.on('connect', () => {
    console.log('[DB] New client connected to PostgreSQL');
});

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 */
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 1000) {
            console.warn(`[DB] Slow query detected (${duration}ms):`, text);
        }
        return res;
    } catch (err) {
        console.error('[DB] Query error:', err.message, '\nQuery:', text);
        throw err;
    }
}

/**
 * Get a client for transactions
 */
async function getClient() {
    const client = await pool.connect();
    const release = client.release.bind(client);
    client.release = () => {
        client.release = release;
        release();
    };
    return client;
}

module.exports = { query, getClient, pool };
