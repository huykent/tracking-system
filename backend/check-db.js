const process = require('process');
process.env.DATABASE_URL = 'postgresql://tracking_user:tracking_pass@127.0.0.1:5432/tracking_db';
const { query } = require('./db');

async function main() {
    try {
        const a = await query('SELECT * FROM api_providers');
        console.log('API Providers:');
        console.table(a.rows);
        const s = await query('SELECT * FROM shipments WHERE tracking_number = \'78985053839922\'');
        console.log('Shipment:');
        console.table(s.rows);
        const e = await query('SELECT * FROM tracking_events WHERE tracking_number = \'78985053839922\'');
        console.log('Events:');
        console.table(e.rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
main();
