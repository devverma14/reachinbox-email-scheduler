import { redisClient } from './redis';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  resetMs: number; // Milliseconds until next hourly window starts
  windowStart: number;
}

/**
 * Checks and atomically increments hourly send count for a sender.
 * Uses a Redis Lua script to prevent race conditions across concurrent workers.
 */
export async function checkAndIncrementHourlyLimit(
  senderEmail: string,
  hourlyLimit: number
): Promise<RateLimitCheckResult> {
  const now = Date.now();
  const ONE_HOUR_MS = 3600 * 1000;
  const currentHourBucket = Math.floor(now / ONE_HOUR_MS);
  const nextHourWindowStart = (currentHourBucket + 1) * ONE_HOUR_MS;
  const resetMs = Math.max(1000, nextHourWindowStart - now);

  const key = `rate_limit:${senderEmail.toLowerCase()}:${currentHourBucket}`;

  // Atomic Lua script: Increment and set TTL if new key
  const luaScript = `
    local current = redis.call('INCR', KEYS[1])
    if current == 1 then
      redis.call('PEXPIRE', KEYS[1], ARGV[1])
    end
    return current
  `;

  const rawResult = await redisClient.eval(
    luaScript,
    1,
    key,
    resetMs.toString()
  );

  const count = typeof rawResult === 'number' ? rawResult : parseInt(String(rawResult || 0), 10);

  if (count <= hourlyLimit) {
    return {
      allowed: true,
      currentCount: count,
      limit: hourlyLimit,
      resetMs: 0,
      windowStart: currentHourBucket * ONE_HOUR_MS,
    };
  } else {
    // Over limit -> decrement back so counter reflects actual allowed sends
    await redisClient.decr(key);
    return {
      allowed: false,
      currentCount: count - 1,
      limit: hourlyLimit,
      resetMs,
      windowStart: currentHourBucket * ONE_HOUR_MS,
    };
  }
}

/**
 * Get current hourly count for a sender without incrementing
 */
export async function getCurrentHourlyCount(senderEmail: string): Promise<number> {
  const now = Date.now();
  const ONE_HOUR_MS = 3600 * 1000;
  const currentHourBucket = Math.floor(now / ONE_HOUR_MS);
  const key = `rate_limit:${senderEmail.toLowerCase()}:${currentHourBucket}`;
  const val = await redisClient.get(key);
  return val ? parseInt(String(val), 10) : 0;
}
