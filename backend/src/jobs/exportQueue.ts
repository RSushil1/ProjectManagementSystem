import { Queue } from 'bullmq';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Use URL string — BullMQ bundles its own ioredis so passing an external
// IORedis instance causes type incompatibility at the AbstractConnector level.
const connectionOptions = {
  connection: {
    host: new URL(redisUrl).hostname,
    port: parseInt(new URL(redisUrl).port || '6379', 10),
    maxRetriesPerRequest: null as null
  }
};

export const exportQueue = new Queue('exports', {
  ...connectionOptions,
  defaultJobOptions: {
    attempts: 3,               // 1 initial + 2 retries (as per README)
    backoff: {
      type: 'exponential',
      delay: 5000              // 5s → 10s → 20s
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 }
  }
});
