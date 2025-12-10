import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { cachedJsonResponse } from "@/lib/cache/headers";
import { cached } from "@/lib/redis";
import { getCacheKey, CACHE_TTL } from "@/lib/cache/supabase-cache";

/**
 * GET /api/feed
 * Returns mixed feed of cards and collections based on ranking
 *
 * Query params:
 * - type: 'card' | 'collection' | 'both' (default: 'both')
 * - mix: 'cards:0.6,collections:0.4' (default ratio)
 * - limit: number (default: 50)
 * - offset: number (default: 0) - DEPRECATED: Use cursor instead
 * - cursor: string (optional) - Cursor for pagination (format: "score:timestamp:itemId")
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { searchParams } = new URL(request.url);

    const typeParam = searchParams.get("type") || "both";
    // Support legacy 'stack' type, convert to 'collection'
    const type = typeParam === "stack" ? "collection" : typeParam;
    const mixParam = searchParams.get("mix") || "cards:0.6,collections:0.4";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const cursor = searchParams.get("cursor"); // Cursor for pagination

    // Generate cache key
    const cacheKey = getCacheKey("feed", {
      type,
      mix: mixParam,
      limit,
      offset,
      cursor: cursor || "none",
    });

    // Use Redis cache with 60s TTL
    const cachedResult = await cached(
      cacheKey,
      async () => {
        return await fetchFeedData(
          supabase,
          type,
          mixParam,
          limit,
          offset,
          cursor
        );
      },
      CACHE_TTL.FEED
    );

    // Return with cache headers
    return cachedJsonResponse(cachedResult, "PUBLIC_READ");
  } catch (error: any) {
    console.error("Error in feed route:", error);
    console.error("Error details:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development" ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch feed data (extracted for caching)
 */
async function fetchFeedData(
  supabase: any,
  type: string,
  mixParam: string,
  limit: number,
  offset: number,
  cursor: string | null
) {
  // Parse mix ratios
  const mixRatios: Record<string, number> = {};
  mixParam.split(",").forEach((part) => {
    const [key, value] = part.split(":");
    if (key && value) {
      mixRatios[key.trim()] = parseFloat(value.trim());
    }
  });

  const cardsRatio = mixRatios.cards || 0.6;
  const collectionsRatio = mixRatios.collections || mixRatios.stacks || 0.4; // Support legacy 'stacks'
  const totalRatio = cardsRatio + collectionsRatio;

  // Normalize ratios
  const normalizedCardsRatio = cardsRatio / totalRatio;
  const normalizedCollectionsRatio = collectionsRatio / totalRatio;

  // Fetch items - use limit directly (no need to fetch 2x, that's wasteful and slow)
  const cardsLimit =
    type === "both"
      ? Math.ceil(limit * normalizedCardsRatio)
      : type === "card"
      ? limit
      : 0;
  const collectionsLimit =
    type === "both"
      ? Math.ceil(limit * normalizedCollectionsRatio)
      : type === "collection"
      ? limit
      : 0;

  const results: any[] = [];

  // Check if new ranking system is enabled
  const useNewRanking = isFeatureEnabled("ranking/final-algo");

  // Fetch ranked cards - fetch from the same offset range to ensure proper mixing
  if (type === "card" || type === "both") {
    let rankedItems: any[] = [];
    let itemsError: any = null;
    let cardIds: string[] = [];

    if (useNewRanking) {
      // Use new ranking_scores table with cursor-based pagination
      let query = supabase
        .from("ranking_scores")
        .select("item_id, norm_score, last_event_at")
        .eq("item_type", "card")
        .not("norm_score", "is", null)
        .order("norm_score", { ascending: false })
        .order("last_event_at", { ascending: false, nullsFirst: false })
        .limit(cardsLimit);

      // Apply cursor if provided (cursor format: "score:timestamp:itemId")
      if (cursor && (type === "card" || type === "both")) {
        try {
          const [cursorScore, cursorTimestamp, cursorItemId] =
            cursor.split(":");

          // Validate parsed values
          if (cursorScore && cursorTimestamp) {
            const score = parseFloat(cursorScore);

            // Fetch items after cursor (lower score or same score with later timestamp)
            query = query.or(
              `norm_score.lt.${score},and(norm_score.eq.${score},last_event_at.lt.${cursorTimestamp})`
            );
          }
        } catch (e) {
          console.warn("Invalid cursor format, ignoring:", cursor);
        }
      }

      const { data, error } = await query;

      rankedItems = data || [];
      itemsError = error;
      cardIds = rankedItems.map((item) => item.item_id);
    } else {
      // Use legacy explore_ranking_items (fallback to recent cards if view doesn't exist)
      const { data, error } = await supabase
        .from("explore_ranking_items")
        .select("item_id, norm_score")
        .eq("item_type", "card")
        .order("norm_score", { ascending: false })
        .range(0, cardsLimit - 1);

      rankedItems = data || [];
      itemsError = error;

      // If error accessing view, it might not exist yet - fall through to recent cards
      if (!itemsError && rankedItems && rankedItems.length > 0) {
        cardIds = rankedItems.map((item) => item.item_id);
      }
    }

    // Fallback: get recent public cards if ranking table is empty
    if (cardIds.length === 0) {
      const { data: recentCards } = await supabase
        .from("cards")
        .select("id")
        .eq("is_public", true)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(cardsLimit);

      if (recentCards) {
        cardIds = recentCards.map((c: { id: any }) => c.id);
      }
    }

    if (cardIds.length > 0) {
      const { data: cards, error: cardsError } = await supabase
        .from("cards")
        .select(
          `
            id,
            canonical_url,
            title,
            description,
            thumbnail_url,
            domain,
            is_public,
            visits_count,
            saves_count,
            upvotes_count,
            comments_count,
            created_at,
            created_by,
            creator:users!cards_created_by_fkey (
              id,
              username,
              display_name,
              avatar_url
            )
          `
        )
        .in("id", cardIds)
        .eq("is_public", true);

      // Fetch attributions separately
      if (!cardsError && cards && cards.length > 0) {
        // Trust the stored counts from the database (triggers should keep them updated)
        // Only fetch actual counts if stored counts are suspiciously 0 for many cards
        // This avoids expensive batch queries on every feed load
        const cardIds = cards.map((c: { id: any }) => c.id);
        const cardsWithZeroCounts = cards.filter(
          (c: { saves_count: number; upvotes_count: number }) =>
            (!c.saves_count || c.saves_count === 0) &&
            (!c.upvotes_count || c.upvotes_count === 0)
        );

        // Only do expensive batch fetch if more than 50% of cards have zero counts (likely trigger issue)
        if (
          cardsWithZeroCounts.length > cards.length * 0.5 &&
          cardIds.length > 0
        ) {
          try {
            // Batch fetch save counts (only for cards with zero counts)
            const zeroCountCardIds = cardsWithZeroCounts.map(
              (c: { id: any }) => c.id
            );
            const [savesResult, votesResult] = await Promise.all([
              supabase
                .from("saves")
                .select("target_id")
                .eq("target_type", "card")
                .in("target_id", zeroCountCardIds),
              supabase
                .from("votes")
                .select("target_id")
                .eq("target_type", "card")
                .in("target_id", zeroCountCardIds),
            ]);

            const savesCountMap = new Map<string, number>();
            const upvotesCountMap = new Map<string, number>();

            savesResult.data?.forEach((save: { target_id: string }) => {
              savesCountMap.set(
                save.target_id,
                (savesCountMap.get(save.target_id) || 0) + 1
              );
            });

            votesResult.data?.forEach((vote: { target_id: string }) => {
              upvotesCountMap.set(
                vote.target_id,
                (upvotesCountMap.get(vote.target_id) || 0) + 1
              );
            });

            // Update only cards with zero counts
            cards.forEach(
              (card: {
                id: string;
                saves_count: number;
                upvotes_count: number;
              }) => {
                const actualSaves = savesCountMap.get(card.id);
                const actualUpvotes = upvotesCountMap.get(card.id);

                if (
                  actualSaves !== undefined &&
                  actualSaves > (card.saves_count || 0)
                ) {
                  card.saves_count = actualSaves;
                }
                if (
                  actualUpvotes !== undefined &&
                  actualUpvotes > (card.upvotes_count || 0)
                ) {
                  card.upvotes_count = actualUpvotes;
                }
              }
            );
          } catch (countError) {
            console.error("[Feed API] Error fetching counts:", countError);
            // Continue with stored counts if fetch fails
          }
        }

        // Fetch attributions
        const { data: attributions } = await supabase
          .from("card_attributions")
          .select(
            `
              id,
              card_id,
              user_id,
              source,
              collection_id,
            stack_id, // Legacy support
              created_at,
              user:users!card_attributions_user_id_fkey (
                id,
                username,
                display_name,
                avatar_url
              )
            `
          )
          .in("card_id", cardIds);

        // Map attributions to cards
        const attributionsMap = new Map();
        attributions?.forEach((attr: { card_id: any }) => {
          if (!attributionsMap.has(attr.card_id)) {
            attributionsMap.set(attr.card_id, []);
          }
          attributionsMap.get(attr.card_id).push(attr);
        });

        // Create score map (use 0 if not in ranking)
        const scoreMap = new Map(
          rankedItems?.map((item) => [item.item_id, item.norm_score]) || []
        );
        const eventMap = new Map(
          rankedItems?.map((item) => [item.item_id, item.last_event_at]) || []
        );

        cards.forEach(
          (card: { id: any; saves_count: any; upvotes_count: any }) => {
            results.push({
              type: "card",
              ...card,
              attributions: attributionsMap.get(card.id) || [],
              score: scoreMap.get(card.id) || 0,
              last_event_at: eventMap.get(card.id) || null,
              // Ensure counts are numbers (not null/undefined)
              saves_count: card.saves_count || 0,
              upvotes_count: card.upvotes_count || 0,
            });
          }
        );
      }
    }
  }

  // Fetch ranked collections - fetch from the same offset range to ensure proper mixing
  if (type === "collection" || type === "both") {
    let rankedItems: any[] = [];
    let itemsError: any = null;
    let collectionIds: string[] = [];

    if (useNewRanking) {
      // Use new ranking_scores table with cursor-based pagination
      let query = supabase
        .from("ranking_scores")
        .select("item_id, norm_score, last_event_at")
        .eq("item_type", "collection")
        .not("norm_score", "is", null)
        .order("norm_score", { ascending: false })
        .order("last_event_at", { ascending: false, nullsFirst: false })
        .limit(collectionsLimit);

      // Apply cursor if provided (cursor format: "score:timestamp:itemId")
      if (cursor && (type === "collection" || type === "both")) {
        try {
          const [cursorScore, cursorTimestamp, cursorItemId] =
            cursor.split(":");
          const score = parseFloat(cursorScore);
          const timestamp = cursorTimestamp;

          // Fetch items after cursor (lower score or same score with later timestamp)
          query = query.or(
            `norm_score.lt.${score},and(norm_score.eq.${score},last_event_at.lt.${timestamp})`
          );
        } catch (e) {
          console.warn("Invalid cursor format, ignoring:", cursor);
        }
      }

      const { data, error } = await query;

      rankedItems = data || [];
      itemsError = error;

      if (error) {
        console.error("[Feed API] Error fetching ranked collections:", error);
      }

      if (rankedItems && rankedItems.length > 0) {
        collectionIds = rankedItems.map((item) => item.item_id);
      } else {
        console.log(
          "[Feed API] No ranked collections found, will use fallback"
        );
        // Fall through to fallback below
      }
    } else {
      // Use legacy explore_ranking_items (fallback to recent collections if view doesn't exist)
      const { data, error } = await supabase
        .from("explore_ranking_items")
        .select("item_id, norm_score")
        .eq("item_type", "collection")
        .order("norm_score", { ascending: false })
        .range(0, collectionsLimit - 1);

      rankedItems = data || [];
      itemsError = error;

      // If error accessing view, it might not exist yet - fall through to recent collections
      if (!itemsError && rankedItems && rankedItems.length > 0) {
        collectionIds = rankedItems.map((item) => item.item_id);
      }
    }

    // Fallback: get recent public collections if ranking table is empty or no scores exist
    if (collectionIds.length === 0) {
      console.log(
        `[Feed API] Using fallback: fetching ${collectionsLimit} recent collections`
      );
      const { data: recentCollections, error: recentError } = await supabase
        .from("collections")
        .select("id")
        .eq("is_public", true)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(collectionsLimit);

      if (recentError) {
        console.error(
          "[Feed API] Error fetching recent collections:",
          recentError
        );
      }

      if (recentCollections && recentCollections.length > 0) {
        collectionIds = recentCollections.map((c: { id: any }) => c.id);
        console.log(
          `[Feed API] Found ${collectionIds.length} recent collections as fallback`
        );
      } else {
        console.log("[Feed API] No recent collections found in fallback");
      }
    }

    if (collectionIds.length > 0) {
      const { data: collections, error: collectionsError } = await supabase
        .from("collections")
        .select(
          `
            id,
            title,
            description,
            slug,
            cover_image_url,
            is_public,
            stats,
            created_at,
            owner_id,
            owner:users!collections_owner_id_fkey (
              id,
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
        .in("id", collectionIds)
        .eq("is_public", true)
        .eq("is_hidden", false);

      if (collectionsError) {
        console.error("Error fetching collections:", collectionsError);
      }

      if (!collectionsError && collections && collections.length > 0) {
        // Fetch first card thumbnails in parallel for collections without cover images
        const collectionsNeedingThumbnails = collections.filter(
          (c: { cover_image_url: any }) => !c.cover_image_url
        );
        const firstCardThumbnails = new Map<string, string | null>();

        if (collectionsNeedingThumbnails.length > 0) {
          // Batch fetch first card thumbnails for all collections at once (more efficient)
          const collectionIds = collectionsNeedingThumbnails.map(
            (c: { id: any }) => c.id
          );

          // Use DISTINCT ON to get first card per collection in a single query
          const { data: firstCards } = await supabase
            .from("collection_cards")
            .select(
              `
                collection_id,
                card:cards!inner (
                  thumbnail_url
                )
              `
            )
            .in("collection_id", collectionIds)
            .order("added_at", { ascending: true });

          // Group by collection_id and take first for each
          const seenCollections = new Set<string>();
          firstCards?.forEach((cc: any) => {
            if (
              !seenCollections.has(cc.collection_id) &&
              cc.card?.thumbnail_url
            ) {
              firstCardThumbnails.set(cc.collection_id, cc.card.thumbnail_url);
              seenCollections.add(cc.collection_id);
            }
          });
        }

        // Create score map (use 0 if not in ranking)
        const scoreMap = new Map(
          rankedItems?.map((item) => [item.item_id, item.norm_score]) || []
        );
        const eventMap = new Map(
          rankedItems?.map((item) => [item.item_id, item.last_event_at]) || []
        );

        collections.forEach(
          (collection: {
            tags: {
              map: (arg0: (ct: any) => any) => {
                (): any;
                new (): any;
                filter: { (arg0: BooleanConstructor): never[]; new (): any };
              };
            };
            stats: {
              views: number;
              upvotes: number;
              saves: number;
              comments: number;
            };
            id: string;
          }) => {
            // Transform tags from nested structure to flat array
            const tags =
              collection.tags?.map((ct: any) => ct.tag).filter(Boolean) || [];

            // Ensure stats has the expected structure
            const stats = collection.stats || {
              views: 0,
              upvotes: 0,
              saves: 0,
              comments: 0,
            };

            results.push({
              type: "collection",
              ...collection,
              tags,
              stats,
              first_card_thumbnail_url:
                firstCardThumbnails.get(collection.id) || null,
              collection_cards: undefined, // Remove nested data
              score: scoreMap.get(collection.id) || 0,
              last_event_at: eventMap.get(collection.id) || null,
            });
          }
        );
      } else if (collectionIds.length === 0) {
        console.log(
          "[Feed API] No collection IDs found - collections may not exist or ranking is empty"
        );
      } else if (!collections || collections.length === 0) {
        console.log(
          "[Feed API] Collections query returned empty - check filters (is_public, is_hidden)"
        );
      }
    }
  }

  // Sort ALL results by score (descending) - this properly mixes cards and collections
  // Tie-break by last_event_at (more recent wins)
  const sortedResults = results.sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (Math.abs(scoreDiff) < 0.0001) {
      // Scores are effectively equal, use last_event_at
      const aTime = a.last_event_at ? new Date(a.last_event_at).getTime() : 0;
      const bTime = b.last_event_at ? new Date(b.last_event_at).getTime() : 0;
      return bTime - aTime;
    }
    return scoreDiff;
  });

  // Dedupe canonical cards while preserving score-based order
  const dedupedResults: any[] = [];
  const seenCardUrls = new Set<string>();

  sortedResults.forEach((item) => {
    if (item.type === "card") {
      // For cards, show first occurrence with all attributions
      if (!seenCardUrls.has(item.canonical_url)) {
        seenCardUrls.add(item.canonical_url);
        dedupedResults.push(item);
      } else {
        // Merge attributions into existing card (keep the one with higher score)
        const existing = dedupedResults.find(
          (r) => r.type === "card" && r.canonical_url === item.canonical_url
        );
        if (existing && item.attributions) {
          // Only merge if the new one has a higher score
          if ((item.score || 0) > (existing.score || 0)) {
            existing.attributions = [
              ...(existing.attributions || []),
              ...item.attributions,
            ];
            existing.score = item.score; // Update to higher score
          } else {
            existing.attributions = [
              ...(existing.attributions || []),
              ...item.attributions,
            ];
          }
        }
      }
    } else {
      // Collections (or legacy stacks)
      dedupedResults.push(item);
    }
  });

  // Re-sort after deduplication to maintain score order
  dedupedResults.sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (Math.abs(scoreDiff) < 0.0001) {
      const aTime = a.last_event_at ? new Date(a.last_event_at).getTime() : 0;
      const bTime = b.last_event_at ? new Date(b.last_event_at).getTime() : 0;
      return bTime - aTime;
    }
    return scoreDiff;
  });

  const finalFeed = dedupedResults.slice(0, limit);

  // Generate next cursor from last item (for pagination)
  let nextCursor: string | null = null;
  if (finalFeed.length > 0 && finalFeed.length === limit) {
    const lastItem = finalFeed[finalFeed.length - 1];
    const score = lastItem.score || 0;
    const timestamp =
      lastItem.last_event_at || lastItem.created_at || new Date().toISOString();
    const itemId = lastItem.id || "";
    nextCursor = `${score}:${timestamp}:${itemId}`;
  }

  // Debug logging
  const collectionCount = finalFeed.filter(
    (item) => item.type === "collection"
  ).length;
  const cardCount = finalFeed.filter((item) => item.type === "card").length;
  console.log(
    `[Feed API] Returning feed: ${collectionCount} collections, ${cardCount} cards, total: ${
      finalFeed.length
    }, nextCursor: ${nextCursor || "none"}`
  );

  // Return data (not response - this is called from cached wrapper)
  return {
    feed: finalFeed,
    total: dedupedResults.length,
    nextCursor,
    hasMore: nextCursor !== null,
  };
}
