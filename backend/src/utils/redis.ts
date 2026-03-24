import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redisClient = new Redis(redisUrl);

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redisClient.on('connect', () => {
  console.log('Successfully connected to Redis');
});

export const getCache = async <T>(key: string): Promise<T | null> => {
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
};

export const setCache = async (key: string, value: any, ttlSeconds: number): Promise<void> => {
  await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
};

export const delCache = async (key: string | string[]): Promise<void> => {
  if (Array.isArray(key)) {
    if (key.length > 0) await redisClient.del(...key);
  } else {
    await redisClient.del(key);
  }
};
