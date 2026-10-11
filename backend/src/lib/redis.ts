import Redis from 'ioredis';
import { config } from '../config';

export const redisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
};

export const redisClient = new Redis(redisOptions);

redisClient.on('error', (err) => {
  console.error('[Redis Client Error]', err);
});

redisClient.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

export default redisClient;
