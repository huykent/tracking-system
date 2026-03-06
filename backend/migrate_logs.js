const { query } = require('./db');

async function migrate() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS api_logs (
                id SERIAL PRIMARY KEY,
                tracking_number VARCHAR(100),
                provider VARCHAR(50),
                request_url TEXT,
                request_method VARCHAR(10),
                request_payload JSONB,
                response_payload JSONB,
                status_code INTEGER,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await query(`
            INSERT INTO settings (key, value) VALUES ('debug_mode', 'false')
            ON CONFLICT (key) DO NOTHING;
        `);
        console.log("Migration successful!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit();
    }
}

migrate();
