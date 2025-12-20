import { redis } from "./client";

export * from "./keys";
export { redis };

export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 60
): Promise<T> {
  if (!redis) return await fetcher();

  const start = Date.now();
  const lockKey = `${key}:lock`;

  try {
    const cachedData = await redis.get<T>(key);
    if (cachedData !== null) {
      // TRACKING: HIT
      if (process.env.NODE_ENV === "development") {
        console.log(`🟢 [CACHE HIT] ${key}`);
      }
      return cachedData;
    }

    // TRACKING: MISS
    if (process.env.NODE_ENV === "development") {
      console.log(`🔴 [CACHE MISS] ${key}`);
    }

    const acquiredLock = await redis.set(lockKey, "1", { nx: true, ex: 10 });

    if (!acquiredLock) {
      await new Promise((r) => setTimeout(r, 200));
      const retryData = await redis.get<T>(key);
      if (retryData !== null) return retryData;
    }

    const data = await fetcher();

    const pipeline = redis.pipeline();
    pipeline.set(key, data, { ex: ttl });
    pipeline.del(lockKey);
    await pipeline.exec();

    return data;
  } catch (error) {
    console.error(`[Cache Error] ${key}:`, error);
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
