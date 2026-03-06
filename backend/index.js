require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Import routers
const shipmentsRouter = require('./api/shipments');
const analyticsRouter = require('./api/analytics');
const telegramRouter = require('./api/telegram');
const settingsRouter = require('./api/settings');

app.use('/api/shipments', shipmentsRouter(db));
app.use('/api/analytics', analyticsRouter(db));
app.use('/api/telegram', telegramRouter(db));
app.use('/api/settings', settingsRouter(db));

require('./worker');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
