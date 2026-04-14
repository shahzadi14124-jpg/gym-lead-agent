import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// ONE single connection for everything - much more stable!
export const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  connectTimeout: 10000, 
  tls: REDIS_URL.startsWith('rediss://') ? {} : undefined,
});

redisConnection.on('error', (err) => {
  // Silent retry to prevent log spamming
});

redisConnection.on('connect', () => {
  console.log('>>> [SUCCESS] Connected to Cloud Redis.');
});
