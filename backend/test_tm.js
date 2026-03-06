const TrackingMoreProvider = require('./providers/trackingmore');

async function testTM() {
    const apiKey = 'y2it7dcr-p0e5-l9go-xcz8-dvfvxyhx3p6m';
    const tn = 'JDK005219156199';
    const provider = new TrackingMoreProvider(apiKey);

    console.log(`[TEST] Tracking ${tn} via TrackingMore...`);
    const result = await provider.track(tn, 'jdexpress');

    if (result) {
        console.log('--- Result ---');
        console.log(`Status: ${result.delivery_status}`);
        console.log(`Events: ${result.events.length}`);
        if (result.events.length > 0) {
            console.log('Most recent event:', result.events[0]);
        }
    } else {
        console.log('No result returned.');
    }
}

testTM();
