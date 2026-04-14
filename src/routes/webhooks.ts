import Redis from 'ioredis';

// Allow configuration from environment, fallback to default local Redis port
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// We share a single connection across BullMQ instances where possible
export const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 10000,
  tls: REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
});

redisConnection.on('error', (err) => {
  console.error('[Redis Error]', err);
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected to Redis queue server.');
});
