export const CACHE_TTL = {
  SHORT: 60,          // 1 minute (Feed, Real-time stats)
  MEDIUM: 300,        // 5 minutes (Explore, Profiles)
  LONG: 3600,         // 1 hour (Static lists)
} as const;

/**
 * Centralized key generators.
 * This ensures we don't have random string concatenation scattered across the app.
 */
export const CacheKeys = {
  // Explore Feed
  explore: (date: string, p0: { days: number; }) => `view:explore:${date}`,
  trendingStacqers: (days: number) => `view:trending-stacqers:${days}d`,
  weekTrending: (week: string, p0: { weekAgo: string; today: string; }) => `view:week-trending:${week}`,

  // Content
  collection: (id: string) => `data:collection:${id}`,
  profile: (username: string) => `data:profile:${username}`,
  
  // Search
  search: (query: string, type: string) => `query:search:${type}:${query}`,

  // Legacy/Generic (Helper for dynamic params)
  generic: (base: string, params: Record<string, string | number>) => {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join("|");
    return `gen:${base}:${paramStr}`;
  }
};