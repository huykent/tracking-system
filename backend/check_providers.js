const { query } = require('./db');

async function checkProviders() {
    try {
        const { rows } = await query('SELECT * FROM api_providers');
        console.log('--- API Providers ---');
        console.table(rows);

        const settings = await query("SELECT * FROM settings WHERE key IN ('17trackKey', 'apiProvider')");
        console.log('--- Settings ---');
        console.table(settings.rows);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkProviders();
