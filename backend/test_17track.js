const Track17Provider = require('./providers/seventeen');
const { query } = require('./db');

async function test17Track() {
    try {
        const { rows } = await query("SELECT api_key FROM api_providers WHERE name = '17track'");
        const apiKey = rows[0]?.api_key;

        if (!apiKey) {
            console.error('No 17Track API key found in DB');
            return;
        }

        console.log('Using API Key:', apiKey.substring(0, 5) + '...');
        const provider = new Track17Provider(apiKey);

        // Example tracking number (user should provide one, but I'll use a dummy or skip)
        const trackingNumber = process.argv[2] || 'LJ925403063US';
        const carrier = 'unknown';

        console.log(`Tracking ${trackingNumber}...`);
        const result = await provider.track(trackingNumber, carrier);

        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

test17Track();
