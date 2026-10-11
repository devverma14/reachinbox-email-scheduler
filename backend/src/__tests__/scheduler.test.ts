import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';
import { redisClient } from '../lib/redis';
import { checkAndIncrementHourlyLimit, getCurrentHourlyCount } from '../lib/rateLimiter';

describe('ReachInbox Scheduling Engine & Rate Limiter Tests', () => {
  const store = new Map<string, number>();

  beforeEach(() => {
    store.clear();
    jest.restoreAllMocks();

    jest.spyOn(redisClient, 'eval').mockImplementation(async (_script: any, _numKeys: any, key: any, _ttl: any) => {
      const current = (store.get(key as string) || 0) + 1;
      store.set(key as string, current);
      return current;
    });

    jest.spyOn(redisClient, 'decr').mockImplementation(async (key: any) => {
      const current = Math.max(0, (store.get(key as string) || 0) - 1);
      store.set(key as string, current);
      return current;
    });

    jest.spyOn(redisClient, 'get').mockImplementation(async (key: any) => {
      const val = store.get(key as string);
      return val !== undefined ? val.toString() : null;
    });
  });

  afterAll(async () => {
    try {
      redisClient.disconnect();
    } catch (_) {}
  });

  const testSender = 'test-sender@reachinbox.ai';

  it('should allow sends under configured hourly limit and increment counter', async () => {
    const limit = 5;

    for (let i = 1; i <= limit; i++) {
      const res = await checkAndIncrementHourlyLimit(testSender, limit);
      expect(res.allowed).toBe(true);
      expect(res.currentCount).toBe(i);
    }

    const currentCount = await getCurrentHourlyCount(testSender);
    expect(currentCount).toBe(limit);
  });

  it('should block sends exceeding hourly limit and calculate window reset delay', async () => {
    const limit = 3;
    const sender = 'limit-test@reachinbox.ai';

    for (let i = 0; i < limit; i++) {
      const res = await checkAndIncrementHourlyLimit(sender, limit);
      expect(res.allowed).toBe(true);
    }

    // 4th send attempt exceeds limit
    const res = await checkAndIncrementHourlyLimit(sender, limit);
    expect(res.allowed).toBe(false);
    expect(res.resetMs).toBeGreaterThan(0);
    expect(res.resetMs).toBeLessThanOrEqual(3600000);
  });
});
