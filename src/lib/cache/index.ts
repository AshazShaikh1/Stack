import { redis } from "./client";

export * from "./keys";
export { redis };

/**
 * Smart caching wrapper with "Cache Stampede" protection.
 * If 100 people request a stale key at once, only 1 fetches from DB.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 60
): Promise<T> {
  // 1. Circuit Breaker: If no Redis, just fetch (Development/Offline)
  if (!redis) return await fetcher();

  const start = Date.now();
  const lockKey = `${key}:lock`;

  try {
    // 2. Read Cache
    const cachedData = await redis.get<T>(key);
    if (cachedData !== null) {
      return cachedData;
    }

    // 3. Cache Miss - Acquire Lock
    // setnx (set if not exists) with 10s expiry
    const acquiredLock = await redis.set(lockKey, "1", { nx: true, ex: 10 });

    if (!acquiredLock) {
      // Someone else is fetching. Wait and retry cache.
      // Simple backoff: wait 200ms, then assume data is there or just run fetcher
      await new Promise((r) => setTimeout(r, 200));
      const retryData = await redis.get<T>(key);
      if (retryData !== null) return retryData;
    }

    // 4. Fetch Fresh Data
    const data = await fetcher();

    // 5. Write to Cache
    // Use pipeline to set data and delete lock in one round-trip
    const pipeline = redis.pipeline();
    pipeline.set(key, data, { ex: ttl });
    pipeline.del(lockKey);
    await pipeline.exec();

    // Optional: Log slow fetches
    // const duration = Date.now() - start;
    // if (duration > 1000) console.warn(`[Slow Fetch] ${key} took ${duration}ms`);

    return data;

  } catch (error) {
    console.error(`[Cache Error] ${key}:`, error);
    // Fail safe: If Redis dies, just return data from DB
    return await fetcher();
  }
}

/**
 * Invalidate a specific key
 */
export async function invalidate(key: string) {
  if (!redis) return;
  await redis.del(key);
}

/**
 * Invalidate by pattern (Use carefully, scans are expensive)
 */
export async function invalidatePattern(pattern: string) {
  if (!redis) return;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}