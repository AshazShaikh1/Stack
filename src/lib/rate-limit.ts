import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Rate limit configurations based on PRD
export const rateLimiters = {
  // Cards: 20/day per user (PRD: default 20 cards/day)
  cards: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 d'),
    analytics: true,
    prefix: '@ratelimit:cards',
  }),

  // Comments: 3/min per user (PRD: comment rate-limit 3/min)
  comments: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 m'),
    analytics: true,
    prefix: '@ratelimit:comments',
  }),

  // Votes: 100/day per user (reasonable limit to prevent abuse)
  votes: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 d'),
    analytics: true,
    prefix: '@ratelimit:votes',
  }),

  // Clones: 10/day per user (PRD: clones/day limit 10/day)
  clones: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 d'),
    analytics: true,
    prefix: '@ratelimit:clones',
  }),

  // Reports: 10/day per user (prevent spam reporting)
  reports: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 d'),
    analytics: true,
    prefix: '@ratelimit:reports',
  }),

  // Stacks: 50/day per user (reasonable limit)
  stacks: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, '1 d'),
    analytics: true,
    prefix: '@ratelimit:stacks',
  }),

  // Saves: 100/day per user (reasonable limit)
  saves: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 d'),
    analytics: true,
    prefix: '@ratelimit:saves',
  }),
};

/**
 * Check rate limit for a user
 * @param limiter - The rate limiter instance
 * @param identifier - User ID or IP address
 * @returns Object with success status and remaining attempts
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    // If Redis is unavailable, allow the request (fail open for MVP)
    // In production, you might want to fail closed or use a fallback
    console.error('Rate limit check failed:', error);
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    };
  }
}

/**
 * Get rate limit identifier from request
 * Uses user ID if authenticated, otherwise IP address
 */
export function getRateLimitIdentifier(
  userId: string | null,
  ipAddress: string | null
): string {
  if (userId) {
    return `user:${userId}`;
  }
  // Fallback to IP if no user ID
  return `ip:${ipAddress || 'unknown'}`;
}

/**
 * Get IP address from request
 */
export function getIpAddress(request: Request): string | null {
  // Try various headers that might contain the real IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return null;
}

