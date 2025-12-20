import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { cachedJsonResponse } from "@/lib/cache/headers";
import { cached, CacheKeys, CACHE_TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { searchParams } = new URL(request.url);

    const typeParam = searchParams.get("type") || "both";
    const type = typeParam === "stack" ? "collection" : typeParam;
    const mixParam = searchParams.get("mix") || "cards:0.6,collections:0.4";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const cursor = searchParams.get("cursor");

    const cacheKey = CacheKeys.generic("feed", {
      type,
      mix: mixParam,
      limit,
      offset,
      cursor: cursor || "none",
    });

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
      CACHE_TTL.SHORT
    );

    return cachedJsonResponse(cachedResult, "PUBLIC_READ");
  } catch (error: any) {
    console.error("Error in feed route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function fetchFeedData(
  supabase: any,
  type: string,
  mixParam: string,
  limit: number,
  offset: number,
  cursor: string | null
) {
  const mixRatios: Record<string, number> = {};
  mixParam.split(",").forEach((part) => {
    const [key, value] = part.split(":");
    if (key && value) mixRatios[key.trim()] = parseFloat(value.trim());
  });

  const cardsRatio = mixRatios.cards || 0.6;
  const collectionsRatio = mixRatios.collections || mixRatios.stacks || 0.4;
  const totalRatio = cardsRatio + collectionsRatio;

  const normalizedCardsRatio = cardsRatio / totalRatio;
  const normalizedCollectionsRatio = collectionsRatio / totalRatio;

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
  const useNewRanking = isFeatureEnabled("ranking/final-algo");

  // --- FETCH CARDS ---
  if (type === "card" || type === "both") {
    let rankedItems: any[] = [];
    let itemsError: any = null;
    let cardIds: string[] = [];

    // 1. Get IDs from Ranking System
    if (useNewRanking) {
      let query = supabase
        .from("ranking_scores")
        .select("item_id, norm_score, last_event_at")
        .eq("item_type", "card")
        .not("norm_score", "is", null)
        .order("norm_score", { ascending: false })
        .order("last_event_at", { ascending: false, nullsFirst: false })
        .limit(cardsLimit);

      if (cursor && (type === "card" || type === "both")) {
        try {
          const [cursorScore, cursorTimestamp] = cursor.split(":");
          if (cursorScore && cursorTimestamp) {
            const score = parseFloat(cursorScore);
            query = query.or(
              `norm_score.lt.${score},and(norm_score.eq.${score},last_event_at.lt.${cursorTimestamp})`
            );
          }
        } catch (e) {}
      }

      const { data, error } = await query;
      rankedItems = data || [];
      itemsError = error;
      cardIds = rankedItems.map((item) => item.item_id);
    } else {
      const { data, error } = await supabase
        .from("explore_ranking_items")
        .select("item_id, norm_score")
        .eq("item_type", "card")
        .order("norm_score", { ascending: false })
        .range(0, cardsLimit - 1);

      rankedItems = data || [];
      itemsError = error;
      if (!itemsError && rankedItems) {
        cardIds = rankedItems.map((item) => item.item_id);
      }
    }

    // 2. Fallback: Recent Standalone Cards
    if (cardIds.length === 0) {
      const { data: recentCards } = await supabase
        .from("cards")
        .select("id")
        .eq("is_public", true)
        .eq("status", "active")
        .is("collection_id", null) // <--- FIX: Only fetch standalone cards
        .order("created_at", { ascending: false })
        .limit(cardsLimit);

      if (recentCards) {
        cardIds = recentCards.map((c: { id: any }) => c.id);
      }
    }

    // 3. Fetch Full Card Details
    if (cardIds.length > 0) {
      const { data: cards } = await supabase
        .from("cards")
        .select(
          `
            id, canonical_url, title, description, thumbnail_url, domain, is_public,
            visits_count, saves_count, upvotes_count, comments_count, created_at, created_by,
            creator:users!cards_created_by_fkey ( id, username, display_name, avatar_url )
        `
        )
        .in("id", cardIds)
        .eq("is_public", true)
        .is("collection_id", null); // <--- FIX: Filter out any ranked cards that are in collections

      if (cards && cards.length > 0) {
        // Fetch attributions
        const { data: attributions } = await supabase
          .from("card_attributions")
          .select(
            `
              id, card_id, user_id, source, collection_id, created_at,
              user:users!card_attributions_user_id_fkey ( id, username, display_name, avatar_url )
          `
          )
          .in("card_id", cardIds);

        const attributionsMap = new Map();
        attributions?.forEach((attr: { card_id: any }) => {
          if (!attributionsMap.has(attr.card_id))
            attributionsMap.set(attr.card_id, []);
          attributionsMap.get(attr.card_id).push(attr);
        });

        const scoreMap = new Map(
          rankedItems?.map((item) => [item.item_id, item.norm_score]) || []
        );
        const eventMap = new Map(
          rankedItems?.map((item) => [item.item_id, item.last_event_at]) || []
        );

        cards.forEach((card: any) => {
          results.push({
            type: "card",
            ...card,
            attributions: attributionsMap.get(card.id) || [],
            score: scoreMap.get(card.id) || 0,
            last_event_at: eventMap.get(card.id) || null,
            saves_count: card.saves_count || 0,
            upvotes_count: card.upvotes_count || 0,
          });
        });
      }
    }
  }

  // --- FETCH COLLECTIONS (Unchanged) ---
  if (type === "collection" || type === "both") {
    let rankedItems: any[] = [];
    let itemsError: any = null;
    let collectionIds: string[] = [];

    if (useNewRanking) {
      let query = supabase
        .from("ranking_scores")
        .select("item_id, norm_score, last_event_at")
        .eq("item_type", "collection")
        .not("norm_score", "is", null)
        .order("norm_score", { ascending: false })
        .order("last_event_at", { ascending: false, nullsFirst: false })
        .limit(collectionsLimit);

      if (cursor && (type === "collection" || type === "both")) {
        try {
          const [cursorScore, cursorTimestamp] = cursor.split(":");
          const score = parseFloat(cursorScore);
          const timestamp = cursorTimestamp;
          query = query.or(
            `norm_score.lt.${score},and(norm_score.eq.${score},last_event_at.lt.${timestamp})`
          );
        } catch (e) {}
      }

      const { data, error } = await query;
      rankedItems = data || [];
      itemsError = error;
      if (rankedItems) collectionIds = rankedItems.map((item) => item.item_id);
    } else {
      const { data, error } = await supabase
        .from("explore_ranking_items")
        .select("item_id, norm_score")
        .eq("item_type", "collection")
        .order("norm_score", { ascending: false })
        .range(0, collectionsLimit - 1);

      rankedItems = data || [];
      itemsError = error;
      if (!itemsError && rankedItems)
        collectionIds = rankedItems.map((item) => item.item_id);
    }

    if (collectionIds.length === 0) {
      const { data: recentCollections } = await supabase
        .from("collections")
        .select("id")
        .eq("is_public", true)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(collectionsLimit);

      if (recentCollections)
        collectionIds = recentCollections.map((c: { id: any }) => c.id);
    }

    if (collectionIds.length > 0) {
      const { data: collections } = await supabase
        .from("collections")
        .select(
          `
            id, title, description, slug, cover_image_url, is_public, stats, created_at, owner_id,
            owner:users!collections_owner_id_fkey ( id, username, display_name, avatar_url ),
            tags:collection_tags ( tag:tags ( id, name ) )
        `
        )
        .in("id", collectionIds)
        .eq("is_public", true)
        .eq("is_hidden", false);

      if (collections && collections.length > 0) {
        const scoreMap = new Map(
          rankedItems?.map((item) => [item.item_id, item.norm_score]) || []
        );
        const eventMap = new Map(
          rankedItems?.map((item) => [item.item_id, item.last_event_at]) || []
        );

        collections.forEach((collection: any) => {
          const tags =
            collection.tags?.map((ct: any) => ct.tag).filter(Boolean) || [];
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
            score: scoreMap.get(collection.id) || 0,
            last_event_at: eventMap.get(collection.id) || null,
          });
        });
      }
    }
  }

  // --- SORT & DEDUPE ---
  const sortedResults = results.sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (Math.abs(scoreDiff) < 0.0001) {
      const aTime = a.last_event_at ? new Date(a.last_event_at).getTime() : 0;
      const bTime = b.last_event_at ? new Date(b.last_event_at).getTime() : 0;
      return bTime - aTime;
    }
    return scoreDiff;
  });

  const dedupedResults: any[] = [];
  const seenCardUrls = new Set<string>();

  sortedResults.forEach((item) => {
    if (item.type === "card") {
      if (!seenCardUrls.has(item.canonical_url)) {
        seenCardUrls.add(item.canonical_url);
        dedupedResults.push(item);
      }
    } else {
      dedupedResults.push(item);
    }
  });

  const finalFeed = dedupedResults.slice(0, limit);

  let nextCursor: string | null = null;
  if (finalFeed.length > 0 && finalFeed.length === limit) {
    const lastItem = finalFeed[finalFeed.length - 1];
    const score = lastItem.score || 0;
    const timestamp =
      lastItem.last_event_at || lastItem.created_at || new Date().toISOString();
    const itemId = lastItem.id || "";
    nextCursor = `${score}:${timestamp}:${itemId}`;
  }

  return {
    feed: finalFeed,
    total: dedupedResults.length,
    nextCursor,
    hasMore: nextCursor !== null,
  };
}
