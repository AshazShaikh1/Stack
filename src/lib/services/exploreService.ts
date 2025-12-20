import { createClient } from "@/lib/supabase/server";
import { cached, CacheKeys, CACHE_TTL } from "@/lib/cache";
import { SELECT_COLLECTION_FULL, SELECT_CARD_FULL } from "@/lib/supabase/queries";

export async function getExploreFeed() {
  const supabase = await createClient();

  // Calculate date ranges
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // 1. TODAY TRENDING
  const todayTrendingResult = await cached(
    CacheKeys.explore(today.toISOString(), { days: 1 }),
    async () => {
      // 1a. Fetch Collections (No change)
      const { data: todayCollections } = await supabase
        .from("collections")
        .select(SELECT_COLLECTION_FULL)
        .eq("is_public", true)
        .eq("is_hidden", false)
        .gte("created_at", today.toISOString())
        .limit(50);

      // 1b. Fetch Standalone Cards
      // FIX: Filter out cards that are likely part of a collection.
      // We rely on 'collection_id' being null. If your schema uses a many-to-many table exclusively,
      // you may need to rely on 'is_standalone' flag if available, or just 'is_public' 
      // assuming cards in collections inherit visibility.
      const { data: todayCards } = await supabase
        .from("cards")
        .select(SELECT_CARD_FULL)
        .eq("status", "active")
        .eq("is_public", true)
        .is("collection_id", null) // <--- CRITICAL: Only show cards NOT attached to a collection
        .gte("created_at", today.toISOString())
        .limit(50);

      // Scoring Helper
      const calculateTrendingScore = (item: any, type: "collection" | "card") => {
        const upvotes = type === "collection" ? item.stats?.upvotes || 0 : item.upvotes_count || 0;
        const saves = type === "collection" ? item.stats?.saves || 0 : item.saves_count || 0;
        const hoursSinceCreation = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
        
        // Boost new items (under 24h)
        const recencyBoost = Math.max(0, 24 - hoursSinceCreation) * 0.5;
        
        return (upvotes * 2) + (saves * 1.5) + recencyBoost;
      };

      // Normalize & Merge
      const collectionsWithScore = (todayCollections || []).map((c: any) => ({
        ...c, 
        type: "collection" as const, 
        trendingScore: calculateTrendingScore(c, "collection"),
      }));

      const cardsWithScore = (todayCards || []).map((c: any) => ({
        ...c, 
        type: "card" as const, 
        trendingScore: calculateTrendingScore(c, "card"),
        metadata: { upvotes: c.upvotes_count || 0, saves: c.saves_count || 0 },
      }));

      const allTrending = [...collectionsWithScore, ...cardsWithScore]
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, 50);

      return { data: allTrending };
    },
    CACHE_TTL.MEDIUM
  );

  // 2. TRENDING STACQERS (Users)
  const trendingStacqersResult = await cached(
    CacheKeys.trendingStacqers(3),
    async () => {
      // Fetch activity signals
      const { data: collectionVotes } = await supabase.from("votes").select("target_id").eq("target_type", "collection").gte("created_at", threeDaysAgo.toISOString());
      const { data: recentFollows } = await supabase.from("follows").select("following_id").gte("created_at", threeDaysAgo.toISOString());
      
      const userStats: Record<string, number> = {};

      const boostUser = (userId: string, points: number) => {
        userStats[userId] = (userStats[userId] || 0) + points;
      };

      // Tally scores (simplified for brevity)
      if (collectionVotes?.length) {
         const ids = collectionVotes.map((v: any) => v.target_id);
         const { data } = await supabase.from("collections").select("owner_id").in("id", ids);
         data?.forEach((c: any) => boostUser(c.owner_id, 2));
      }
      
      recentFollows?.forEach((f: any) => boostUser(f.following_id, 3));

      const topUserIds = Object.entries(userStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id]) => id);

      if (topUserIds.length === 0) return { data: [] };

      const { data: users } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url")
        .in("id", topUserIds);

      return { data: users || [] };
    },
    CACHE_TTL.MEDIUM
  );

  // 3. LAST WEEK TRENDING
  const weekTrendingResult = await cached(
    CacheKeys.weekTrending(weekAgo.toISOString(), { weekAgo: weekAgo.toISOString(), today: today.toISOString() }),
    async () => {
      const { data: weekCollections } = await supabase
        .from("collections")
        .select(SELECT_COLLECTION_FULL) // <--- Updated
        .eq("is_public", true)
        .eq("is_hidden", false)
        .gte("created_at", weekAgo.toISOString())
        .lt("created_at", today.toISOString())
        .order("created_at", { ascending: false })
        .limit(30);

      const { data: weekCards } = await supabase
        .from("cards")
        .select(SELECT_CARD_FULL) // <--- Updated
        .eq("status", "active")
        .eq("is_public", true)
        .gte("created_at", weekAgo.toISOString())
        .lt("created_at", today.toISOString())
        .order("created_at", { ascending: false })
        .limit(30);

      const calculateWeekScore = (item: any, type: "collection" | "card") => {
        const upvotes = type === "collection" ? item.stats?.upvotes || 0 : item.upvotes_count || 0;
        const saves = type === "collection" ? item.stats?.saves || 0 : item.saves_count || 0;
        return upvotes * 2 + saves * 1.5;
      };

      const collectionsWithScore = (weekCollections || []).map((c: any) => ({
        ...c, type: "collection" as const, trendingScore: calculateWeekScore(c, "collection"),
      }));

      const cardsWithScore = (weekCards || []).map((c: any) => ({
        ...c, type: "card" as const, trendingScore: calculateWeekScore(c, "card"),
        metadata: { upvotes: c.upvotes_count || 0, saves: c.saves_count || 0 },
      }));

      const allWeekTrending = [...collectionsWithScore, ...cardsWithScore].sort((a, b) => b.trendingScore - a.trendingScore);
      return { data: allWeekTrending };
    },
    CACHE_TTL.MEDIUM
  );

  return {
    todayTrending: todayTrendingResult?.data || [],
    trendingStacqers: trendingStacqersResult?.data || [],
    weekTrending: weekTrendingResult?.data || [],
  };
}