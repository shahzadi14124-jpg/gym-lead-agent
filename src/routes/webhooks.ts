import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Factory function to give every worker its own isolated connection
export const createRedisConnection = () => {
  const conn = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    keepAlive: 10000, // Forces the connection to stay alive every 10 seconds
    tls: REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
  });

  conn.on('error', (err) => {
    // Suppress logs; BullMQ will automatically reconnect when needed
  });
  return conn;
};
