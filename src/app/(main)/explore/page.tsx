import { FeedGrid } from "@/components/feed/FeedGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrendingStacqerCard } from "@/components/explore/TrendingStacqerCard";
import { createClient } from "@/lib/supabase/server";
import { cached, CACHE_TTL } from "@/lib/redis";
import { getCacheKey } from "@/lib/cache/supabase-cache";

export default async function ExplorePage() {
  const supabase = await createClient();

  // Calculate date ranges
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // 1. TODAY TRENDING - Top 5 (cards or collections, whatever is trending)
  const todayTrendingResult = await cached(
    getCacheKey("today-trending", { date: today.toISOString() }),
    async () => {
      // Fetch today's collections
      const { data: todayCollections } = await supabase
        .from("collections")
        .select(
          `
          id,
          title,
          description,
          cover_image_url,
          owner_id,
          stats,
          created_at,
          owner:users!collections_owner_id_fkey (
            username,
            display_name,
            avatar_url
          ),
          tags:collection_tags (
            tag:tags (
              id,
              name
            )
          )
        `
        )
        .eq("is_public", true)
        .eq("is_hidden", false)
        .gte("created_at", today.toISOString())
        .limit(50);

      // Fetch today's cards
      const { data: todayCards } = await supabase
        .from("cards")
        .select(
          `
          id,
          title,
          description,
          thumbnail_url,
          canonical_url,
          domain,
          created_at,
          upvotes_count,
          saves_count,
          created_by,
          creator:users!cards_created_by_fkey (
            username,
            display_name,
            avatar_url
          )
        `
        )
        .eq("status", "active")
        .eq("is_public", true) // <--- FIX ADDED HERE
        .gte("created_at", today.toISOString())
        .limit(50);

      // Calculate trending score for each item
      const calculateTrendingScore = (
        item: any,
        type: "collection" | "card"
      ) => {
        const upvotes =
          type === "collection"
            ? item.stats?.upvotes || 0
            : item.upvotes_count || 0;
        const saves =
          type === "collection"
            ? item.stats?.saves || 0
            : item.saves_count || 0;

        // Trending score: upvotes * 2 + saves * 1.5 + recency boost
        const hoursSinceCreation =
          (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
        const recencyBoost = Math.max(0, 24 - hoursSinceCreation) * 0.5;

        return upvotes * 2 + saves * 1.5 + recencyBoost;
      };

      // Combine and sort
      const collectionsWithScore = (todayCollections || []).map((c: any) => ({
        ...c,
        type: "collection" as const,
        trendingScore: calculateTrendingScore(c, "collection"),
      }));

      const cardsWithScore = (todayCards || []).map((c: any) => ({
        ...c,
        type: "card" as const,
        trendingScore: calculateTrendingScore(c, "card"),
        metadata: {
          upvotes: c.upvotes_count || 0,
          saves: c.saves_count || 0,
        },
      }));

      const allTrending = [...collectionsWithScore, ...cardsWithScore]
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, 5);

      return { data: allTrending };
    },
    CACHE_TTL.EXPLORE
  );
  const todayTrending = todayTrendingResult?.data || [];

  // 2. TOP 3 TRENDING STACQERS (last 3 days)
  const trendingStacqersResult = await cached(
    getCacheKey("trending-stacqers", { days: 3 }),
    async () => {
      // Get upvotes on collections in last 3 days
      const { data: collectionVotes } = await supabase
        .from("votes")
        .select("target_id")
        .eq("target_type", "collection")
        .gte("created_at", threeDaysAgo.toISOString());

      // Get upvotes on cards in last 3 days
      const { data: cardVotes } = await supabase
        .from("votes")
        .select("target_id")
        .eq("target_type", "card")
        .gte("created_at", threeDaysAgo.toISOString());

      // Get followers increased in last 3 days
      const { data: recentFollows } = await supabase
        .from("follows")
        .select("following_id")
        .gte("created_at", threeDaysAgo.toISOString());

      // Get saves on collections in last 3 days
      const { data: recentSaves } = await supabase
        .from("saves")
        .select("target_id, collections!inner(owner_id)")
        .eq("target_type", "collection")
        .gte("created_at", threeDaysAgo.toISOString());

      // Calculate stats per user
      const userStats: Record<
        string,
        {
          upvotes_received: number;
          followers_increased: number;
          saves_received: number;
        }
      > = {};

      // Count upvotes on collections - fetch owners separately
      if (collectionVotes && collectionVotes.length > 0) {
        const collectionIds = collectionVotes
          .map((v: any) => v.target_id)
          .filter(Boolean);
        if (collectionIds.length > 0) {
          const { data: collections } = await supabase
            .from("collections")
            .select("id, owner_id")
            .in("id", collectionIds);

          if (collections) {
            const collectionOwnerMap: Record<string, string> = {};
            collections.forEach((c: any) => {
              collectionOwnerMap[c.id] = c.owner_id;
            });

            collectionVotes.forEach((vote: any) => {
              const userId = collectionOwnerMap[vote.target_id];
              if (userId) {
                if (!userStats[userId]) {
                  userStats[userId] = {
                    upvotes_received: 0,
                    followers_increased: 0,
                    saves_received: 0,
                  };
                }
                userStats[userId].upvotes_received++;
              }
            });
          }
        }
      }

      // Count upvotes on cards - fetch creators separately
      if (cardVotes && cardVotes.length > 0) {
        const cardIds = cardVotes.map((v: any) => v.target_id).filter(Boolean);
        if (cardIds.length > 0) {
          const { data: cards } = await supabase
            .from("cards")
            .select("id, created_by")
            .in("id", cardIds);

          if (cards) {
            const cardCreatorMap: Record<string, string> = {};
            cards.forEach((c: any) => {
              if (c.created_by) {
                cardCreatorMap[c.id] = c.created_by;
              }
            });

            cardVotes.forEach((vote: any) => {
              const userId = cardCreatorMap[vote.target_id];
              if (userId) {
                if (!userStats[userId]) {
                  userStats[userId] = {
                    upvotes_received: 0,
                    followers_increased: 0,
                    saves_received: 0,
                  };
                }
                userStats[userId].upvotes_received++;
              }
            });
          }
        }
      }

      // Count followers
      if (recentFollows) {
        recentFollows.forEach((follow: any) => {
          const userId = follow.following_id;
          if (userId) {
            if (!userStats[userId]) {
              userStats[userId] = {
                upvotes_received: 0,
                followers_increased: 0,
                saves_received: 0,
              };
            }
            userStats[userId].followers_increased++;
          }
        });
      }

      // Count saves - need to fetch collection owners separately
      if (recentSaves && recentSaves.length > 0) {
        const collectionIds = recentSaves
          .map((s: any) => s.target_id)
          .filter(Boolean);
        if (collectionIds.length > 0) {
          const { data: collections } = await supabase
            .from("collections")
            .select("id, owner_id")
            .in("id", collectionIds);

          if (collections) {
            const collectionOwnerMap: Record<string, string> = {};
            collections.forEach((c: any) => {
              collectionOwnerMap[c.id] = c.owner_id;
            });

            recentSaves.forEach((save: any) => {
              const userId = collectionOwnerMap[save.target_id];
              if (userId) {
                if (!userStats[userId]) {
                  userStats[userId] = {
                    upvotes_received: 0,
                    followers_increased: 0,
                    saves_received: 0,
                  };
                }
                userStats[userId].saves_received++;
              }
            });
          }
        }
      }

      // Get user details for users with activity
      const userIds = Object.keys(userStats);
      if (userIds.length === 0) {
        return { data: [] };
      }

      const { data: users } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds);

      // Combine user data with stats and calculate total score
      const usersWithStats = (users || [])
        .map((user: any) => {
          const stats = userStats[user.id] || {
            upvotes_received: 0,
            followers_increased: 0,
            saves_received: 0,
          };
          const totalScore =
            stats.upvotes_received * 2 +
            stats.followers_increased * 3 +
            stats.saves_received * 1.5;
          return {
            ...user,
            stats,
            totalScore,
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 3);

      return { data: usersWithStats };
    },
    CACHE_TTL.EXPLORE
  );
  const trendingStacqers = trendingStacqersResult?.data || [];

  // 3. LAST WEEK TRENDING (both cards and collections)
  const weekTrendingResult = await cached(
    getCacheKey("week-trending", {
      weekAgo: weekAgo.toISOString(),
      today: today.toISOString(),
    }),
    async () => {
      // Fetch last week's collections
      const { data: weekCollections } = await supabase
        .from("collections")
        .select(
          `
          id,
          title,
          description,
          cover_image_url,
          owner_id,
          stats,
          created_at,
          owner:users!collections_owner_id_fkey (
            username,
            display_name,
            avatar_url
          ),
          tags:collection_tags (
            tag:tags (
              id,
              name
            )
          )
        `
        )
        .eq("is_public", true)
        .eq("is_hidden", false)
        .gte("created_at", weekAgo.toISOString())
        .lt("created_at", today.toISOString())
        .order("created_at", { ascending: false })
        .limit(30);

      // Fetch last week's cards
      const { data: weekCards } = await supabase
        .from("cards")
        .select(
          `
          id,
          title,
          description,
          thumbnail_url,
          canonical_url,
          domain,
          created_at,
          upvotes_count,
          saves_count,
          created_by,
          creator:users!cards_created_by_fkey (
            username,
            display_name,
            avatar_url
          )
        `
        )
        .eq("status", "active")
        .eq("is_public", true) // <--- FIX ADDED HERE
        .gte("created_at", weekAgo.toISOString())
        .lt("created_at", today.toISOString())
        .order("created_at", { ascending: false })
        .limit(30);

      // Calculate trending score and combine
      const calculateWeekScore = (item: any, type: "collection" | "card") => {
        const upvotes =
          type === "collection"
            ? item.stats?.upvotes || 0
            : item.upvotes_count || 0;
        const saves =
          type === "collection"
            ? item.stats?.saves || 0
            : item.saves_count || 0;
        return upvotes * 2 + saves * 1.5;
      };

      const collectionsWithScore = (weekCollections || []).map((c: any) => ({
        ...c,
        type: "collection" as const,
        trendingScore: calculateWeekScore(c, "collection"),
      }));

      const cardsWithScore = (weekCards || []).map((c: any) => ({
        ...c,
        type: "card" as const,
        trendingScore: calculateWeekScore(c, "card"),
        metadata: {
          upvotes: c.upvotes_count || 0,
          saves: c.saves_count || 0,
        },
      }));

      const allWeekTrending = [...collectionsWithScore, ...cardsWithScore].sort(
        (a, b) => b.trendingScore - a.trendingScore
      );

      return { data: allWeekTrending };
    },
    CACHE_TTL.EXPLORE
  );
  const weekTrending = weekTrendingResult?.data || [];

  return (
    <div className="min-h-screen bg-cloud">
      <div className="container mx-auto px-4 md:px-page py-6 md:py-8 lg:py-12">
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-jet-dark mb-2">
            Explore
          </h1>
          <p className="text-base md:text-lg text-gray-muted">
            Discover trending collections, cards, and top creators
          </p>
        </div>

        {/* 1. Today Trending - Top 5 */}
        {todayTrending.length > 0 && (
          <div className="mb-12 md:mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-semibold text-jet-dark">
                Today Trending
              </h2>
              <span className="text-sm text-gray-muted">Top 5</span>
            </div>
            <FeedGrid items={todayTrending} hideHoverButtons={false} />
          </div>
        )}

        {/* 2. Top 3 Trending Stacqers */}
        {trendingStacqers.length > 0 && (
          <div className="mb-12 md:mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-semibold text-jet-dark">
                Top Trending Stacqers
              </h2>
              <span className="text-sm text-gray-muted">Last 3 days</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              {trendingStacqers.map((user: any, index: number) => (
                <TrendingStacqerCard
                  key={user.id}
                  user={user}
                  rank={index + 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* 3. Last Week Trending */}
        {weekTrending.length > 0 && (
          <div className="mb-12 md:mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-semibold text-jet-dark">
                Last Week Trending
              </h2>
            </div>
            <FeedGrid items={weekTrending} hideHoverButtons={false} />
          </div>
        )}

        {/* Empty State */}
        {todayTrending.length === 0 &&
          trendingStacqers.length === 0 &&
          weekTrending.length === 0 && (
            <EmptyState
              icon="📊"
              title="No trending content yet"
              description="Be the first to create and share content with the community"
              action={{
                label: "Create Collection",
                href: "/",
              }}
            />
          )}
      </div>
    </div>
  );
}
