import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { cachedJsonResponse } from "@/lib/cache/headers";
import { cached, CacheKeys, CACHE_TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const type =
      searchParams.get("type") === "stacks"
        ? "collections"
        : searchParams.get("type") || "all";
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ error: "Query required" }, { status: 400 });
    }

    const searchQuery = q.trim();
    const cacheKey = CacheKeys.search(searchQuery, type);

    const results = await cached(
      cacheKey,
      async () => {
        const searchResults: any = {
          collections: [],
          cards: [],
          users: [],
          total: 0,
        };

        // 1. Search Collections (Title, Description, or Tags)
        if (type === "all" || type === "collections") {
          // Note: Full text search on tags usually requires a separate join filter or RPC.
          // Here we use a broad ILIKE on title/desc as a baseline.
          const { data } = await supabase
            .from("collections")
            .select(
              `
              id, title, description, cover_image_url, owner_id, slug,
              owner:users!collections_owner_id_fkey(username, display_name, avatar_url)
            `
            )
            .eq("is_public", true)
            .or(
              `title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
            )
            .limit(limit);

          if (data) searchResults.collections = data;
        }

        // 2. Search Cards (Title, Description, Metadata Keywords)
        if (type === "all" || type === "cards") {
          const { data } = await supabase
            .from("cards")
            .select(
              `
              id, title, description, thumbnail_url, domain,
              creator:users!cards_created_by_fkey(username, display_name)
            `
            )
            .eq("status", "active")
            .eq("is_public", true) // Show public cards in search even if they are in collections
            .or(
              `title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
            )
            .limit(limit);

          if (data) searchResults.cards = data;
        }

        // 3. Search Users
        if (type === "all" || type === "users") {
          const { data } = await supabase
            .from("users")
            .select("id, username, display_name, avatar_url")
            .or(
              `username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`
            )
            .limit(limit);

          if (data) searchResults.users = data;
        }

        searchResults.total =
          searchResults.collections.length +
          searchResults.cards.length +
          searchResults.users.length;
        return searchResults;
      },
      CACHE_TTL.MEDIUM
    );

    results.total =
      (results.collections?.length || 0) +
      (results.cards?.length || 0) +
      (results.users?.length || 0);

    // Cache search results (longer TTL since search queries change less frequently)
    return cachedJsonResponse(results, "SEARCH");
  } catch (error) {
    console.error("Error in search route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
