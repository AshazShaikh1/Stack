import { Redis } from "@upstash/redis";

// Initialize Redis client (Upstash Redis)
// Uses environment variables: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/**
 * Cache utility with logging and cache stampede protection
 * Wraps expensive operations with Redis caching
 */
export async function cached<T>(
  queryKey: string,
  fetcherFn: () => Promise<T>,
  ttl: number = 60
): Promise<T> {
  const startTime = Date.now();
  const lockKey = `${queryKey}:lock`;
  const lockTTL = 10;

  // If Redis is not configured, just execute the fetcher
  if (!redis) {
    // Only log this once per key or use debug level to reduce noise
    // console.log(`[Cache] Redis not configured, executing directly: ${queryKey}`);
    const data = await fetcherFn();
    return data;
  }

  try {
    // Try to get from cache
    const cached = await redis.get(queryKey);

    if (cached !== null) {
      const duration = Date.now() - startTime;
      console.log(`[Cache] ✅ Redis HIT: ${queryKey} (${duration}ms)`);
      return cached as T;
    }

    // Cache miss - check for lock (cache stampede protection)
    const lockExists = await redis.exists(lockKey);
    if (lockExists) {
      console.log(`[Cache] ⏳ Lock exists, waiting: ${queryKey}`);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Retry cache read
      const retryCached = await redis.get(queryKey);
      if (retryCached !== null) {
        return retryCached as T;
      }
    }

    // Set lock
    await redis.set(lockKey, "1", { ex: lockTTL });

    try {
      // Execute fetcher
      const data = await fetcherFn();
      const duration = Date.now() - startTime;

      // Store in cache
      await redis.set(queryKey, data as any, { ex: ttl });
      console.log(
        `[Cache] 💾 Cached: ${queryKey} (TTL: ${ttl}s, DB time: ${duration}ms)`
      );

      // Remove lock
      await redis.del(lockKey);

      return data;
    } catch (fetchError) {
      await redis.del(lockKey);
      throw fetchError;
    }
  } catch (error: any) {
    // FIX: Explicitly log error message to see why it failed
    console.error(
      `[Cache] Redis error for ${queryKey}:`,
      error.message || error
    );
    console.warn(`[Cache] Falling back to direct DB hit for ${queryKey}`);

    // Fallback to direct execution
    const data = await fetcherFn();
    return data;
  }
}

/**
 * Invalidate cache by key pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  if (!redis) return;
  console.log(`[Cache] Invalidation requested for pattern: ${pattern}`);
}

/**
 * Clear specific cache key
 */
export async function clearCache(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
    console.log(`[Cache] Cleared: ${key}`);
  } catch (error) {
    console.error(`[Cache] Error clearing cache:`, error);
  }
}

export const CACHE_TTL = {
  FEED: 60,           // 1 minute
  EXPLORE: 300,       // 5 minutes
  COLLECTIONS: 120,   // 2 minutes
  USER_PROFILE: 300,  // 5 minutes
  SEARCH: 600,        // 10 minutes
};

export { redis };
