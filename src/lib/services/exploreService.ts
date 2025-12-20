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
      // Use centralized SELECT_COLLECTION_FULL
      const { data: todayCollections } = await supabase
        .from("collections")
        .select(SELECT_COLLECTION_FULL)
        .eq("is_public", true)
        .eq("is_hidden", false)
        .gte("created_at", today.toISOString())
        .limit(50);

      // Use centralized SELECT_CARD_FULL
      const { data: todayCards } = await supabase
        .from("cards")
        .select(SELECT_CARD_FULL)
        .eq("status", "active")
        .eq("is_public", true)
        .gte("created_at", today.toISOString())
        .limit(50);

      const calculateTrendingScore = (item: any, type: "collection" | "card") => {
        const upvotes = type === "collection" ? item.stats?.upvotes || 0 : item.upvotes_count || 0;
        const saves = type === "collection" ? item.stats?.saves || 0 : item.saves_count || 0;
        const hoursSinceCreation = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
        const recencyBoost = Math.max(0, 24 - hoursSinceCreation) * 0.5;
        return upvotes * 2 + saves * 1.5 + recencyBoost;
      };

      const collectionsWithScore = (todayCollections || []).map((c: any) => ({
        ...c, type: "collection" as const, trendingScore: calculateTrendingScore(c, "collection"),
      }));

      const cardsWithScore = (todayCards || []).map((c: any) => ({
        ...c, type: "card" as const, trendingScore: calculateTrendingScore(c, "card"),
        metadata: { upvotes: c.upvotes_count || 0, saves: c.saves_count || 0 },
      }));

      const allTrending = [...collectionsWithScore, ...cardsWithScore]
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, 5);

      return { data: allTrending };
    },
    CACHE_TTL.MEDIUM // 5 minutes
  );

  // 2. TRENDING STACQERS
  const trendingStacqersResult = await cached(
    CacheKeys.trendingStacqers(3),
    async () => {
      const { data: collectionVotes } = await supabase.from("votes").select("target_id").eq("target_type", "collection").gte("created_at", threeDaysAgo.toISOString());
      const { data: cardVotes } = await supabase.from("votes").select("target_id").eq("target_type", "card").gte("created_at", threeDaysAgo.toISOString());
      const { data: recentFollows } = await supabase.from("follows").select("following_id").gte("created_at", threeDaysAgo.toISOString());
      const { data: recentSaves } = await supabase.from("saves").select("target_id, collections!inner(owner_id)").eq("target_type", "collection").gte("created_at", threeDaysAgo.toISOString());

      const userStats: Record<string, { upvotes_received: number; followers_increased: number; saves_received: number }> = {};

      const updateStat = (userId: string, field: keyof typeof userStats[string]) => {
        if (!userStats[userId]) userStats[userId] = { upvotes_received: 0, followers_increased: 0, saves_received: 0 };
        userStats[userId][field]++;
      };

      if (collectionVotes?.length) {
        const ids = collectionVotes.map((v: any) => v.target_id).filter(Boolean);
        if (ids.length) {
          const { data } = await supabase.from("collections").select("id, owner_id").in("id", ids);
          const map: Record<string, string> = {};
          data?.forEach((c: any) => map[c.id] = c.owner_id);
          collectionVotes.forEach((v: any) => { if (map[v.target_id]) updateStat(map[v.target_id], 'upvotes_received'); });
        }
      }

      if (cardVotes?.length) {
        const ids = cardVotes.map((v: any) => v.target_id).filter(Boolean);
        if (ids.length) {
          const { data } = await supabase.from("cards").select("id, created_by").in("id", ids);
          const map: Record<string, string> = {};
          data?.forEach((c: any) => { if (c.created_by) map[c.id] = c.created_by; });
          cardVotes.forEach((v: any) => { if (map[v.target_id]) updateStat(map[v.target_id], 'upvotes_received'); });
        }
      }

      recentFollows?.forEach((f: any) => { if (f.following_id) updateStat(f.following_id, 'followers_increased'); });

      if (recentSaves?.length) {
        const ids = recentSaves.map((s: any) => s.target_id).filter(Boolean);
        if (ids.length) {
          const { data } = await supabase.from("collections").select("id, owner_id").in("id", ids);
          const map: Record<string, string> = {};
          data?.forEach((c: any) => map[c.id] = c.owner_id);
          recentSaves.forEach((s: any) => { if (map[s.target_id]) updateStat(map[s.target_id], 'saves_received'); });
        }
      }

      const userIds = Object.keys(userStats);
      if (userIds.length === 0) return { data: [] };

      const { data: users } = await supabase.from("users").select("id, username, display_name, avatar_url").in("id", userIds);

      const usersWithStats = (users || []).map((user: any) => {
        const stats = userStats[user.id] || { upvotes_received: 0, followers_increased: 0, saves_received: 0 };
        const totalScore = stats.upvotes_received * 2 + stats.followers_increased * 3 + stats.saves_received * 1.5;
        return { ...user, stats, totalScore };
      }).sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);

      return { data: usersWithStats };
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