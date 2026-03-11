const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
        const delay = Math.min(times * 500, 5000);
        console.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
    }
});

redis.on('connect', () => console.log('[Redis] Connected'));
redis.on('error', (err) => console.error('[Redis] Error:', err.message));
redis.on('close', () => console.warn('[Redis] Connection closed'));

// ─── Helpers ─────────────────────────────────────────────

/** Cache a value with TTL in seconds */
async function setCache(key, value, ttlSeconds = 300) {
    await redis.set(`tracking:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
}

/** Get cached value */
async function getCache(key) {
    const val = await redis.get(`tracking:${key}`);
    return val ? JSON.parse(val) : null;
}

/** Delete cached value */
async function delCache(key) {
    await redis.del(`tracking:${key}`);
}

/** Increment a counter (for rate limiting) */
async function incr(key, ttlSeconds = 86400) {
    const pipeline = redis.pipeline();
    pipeline.incr(`tracking:${key}`);
    pipeline.expire(`tracking:${key}`, ttlSeconds);
    const results = await pipeline.exec();
    return results[0][1]; // return new count
}

/** Get a counter value */
async function getCount(key) {
    const val = await redis.get(`tracking:${key}`);
    return val ? parseInt(val) : 0;
}

module.exports = { redis, setCache, getCache, delCache, incr, getCount };
