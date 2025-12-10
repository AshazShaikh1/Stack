import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createServiceClient } from "@/lib/supabase/api-service";
import {
  rateLimiters,
  checkRateLimit,
  getRateLimitIdentifier,
  getIpAddress,
} from "@/lib/rate-limit";
import { checkUserCardLimit } from "@/lib/monitoring/alerts";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: "Unauthorized - Please log in again" },
        { status: 401 }
      );
    }

    // Rate limiting: 20 cards/day per user (PRD requirement)
    const ipAddress = getIpAddress(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimitResult = await checkRateLimit(
      rateLimiters.cards,
      identifier
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. You can create up to 20 cards per day.",
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.reset,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
          },
        }
      );
    }

    // Check for monitoring alerts (cards per user)
    checkUserCardLimit(user.id, supabase).catch((err) => {
      console.error("Error checking user card limit:", err);
    });

    // Use service client for operations that might bypass RLS (finding duplicates)
    const serviceClient = createServiceClient();

    const {
      url,
      title,
      description,
      thumbnail_url,
      collection_id,
      stack_id,
      is_public,
      source,
    } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Determine target collection ID (handling legacy stack_id)
    const id = collection_id || stack_id;
    const attributionSource = source || (id ? "collection" : "manual");

    // Check if user is a stacqer/admin
    const { data: userProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const isStacker =
      userProfile?.role === "stacker" || userProfile?.role === "admin";

    // Determine card visibility
    let cardIsPublic = false;

    if (id) {
      // Check collection visibility
      // NOTE: We query 'collections' table even for legacy stack_id
      const { data: collection } = await supabase
        .from("collections")
        .select("is_public, owner_id")
        .eq("id", id)
        .maybeSingle();

      if (collection) {
        cardIsPublic = collection.is_public === true;
      } else {
        cardIsPublic = false;
      }
    } else {
      // Standalone card logic
      if (isStacker) {
        cardIsPublic = is_public !== undefined ? is_public : false;
      } else {
        cardIsPublic = false;
        if (is_public === true) {
          console.warn(
            `User ${user.id} attempted to create standalone public card but is not a stacqer`
          );
        }
      }
    }

    // Canonicalize URL
    const { canonicalizeUrl } = await import("@/lib/metadata/extractor");
    const normalizedUrl = canonicalizeUrl(url);

    // Process Amazon affiliate links (background function)
    const processAffiliateLink = async (
      cardIdToUpdate: string,
      existingMetadata: any = {}
    ) => {
      try {
        const {
          isAmazonLink,
          addAmazonAffiliateTag,
          getAmazonAffiliateConfig,
        } = await import("@/lib/affiliate/amazon");
        const config = getAmazonAffiliateConfig();

        if (config && isAmazonLink(normalizedUrl)) {
          const affiliateUrl = addAmazonAffiliateTag(normalizedUrl, config);

          if (affiliateUrl && affiliateUrl !== normalizedUrl) {
            try {
              await serviceClient
                .from("cards")
                .update({
                  metadata: {
                    ...existingMetadata,
                    affiliate_url: affiliateUrl,
                    is_amazon_product: true,
                  },
                })
                .eq("id", cardIdToUpdate);
            } catch (error) {
              // Silently fail
            }
          }
        }
      } catch (error) {
        // Silently fail
      }
    };

    const domain = new URL(normalizedUrl).hostname.replace("www.", "");

    // Insert or get existing card
    const { data: card, error: cardError } = await serviceClient
      .from("cards")
      .insert({
        canonical_url: normalizedUrl,
        title: title || null,
        description: description || null,
        thumbnail_url: thumbnail_url || null,
        domain,
        created_by: user.id,
        status: "active",
        is_public: cardIsPublic,
        metadata: {},
      })
      .select()
      .single();

    let cardId: string;

    if (cardError) {
      // If conflict (duplicate canonical_url), fetch existing card
      if (cardError.code === "23505") {
        // FIX: Use serviceClient to find the card to bypass RLS visibility checks
        const { data: existingCard } = await serviceClient
          .from("cards")
          .select("id, metadata")
          .eq("canonical_url", normalizedUrl)
          .single();

        if (existingCard) {
          cardId = existingCard.id;
          processAffiliateLink(cardId, existingCard.metadata || {});
        } else {
          return NextResponse.json(
            { error: "Failed to create or find card" },
            { status: 400 }
          );
        }
      } else {
        console.error("Card creation error:", cardError);
        return NextResponse.json(
          { error: cardError.message || "Failed to create card" },
          { status: 400 }
        );
      }
    } else {
      cardId = card.id;
      processAffiliateLink(cardId, card.metadata || {});
    }

    // Create attribution
    const { error: attributionError } = await serviceClient
      .from("card_attributions")
      .insert({
        card_id: cardId,
        user_id: user.id,
        source: attributionSource,
        collection_id: id || null, // Map to collection_id
      });

    if (attributionError && attributionError.code !== "23505") {
      console.error("Attribution creation error:", attributionError);
    }

    // Link card to collection
    if (id) {
      // Always use 'collection_cards' table (legacy 'stack_cards' is deprecated)
      const tableName = "collection_cards";
      const idField = "collection_id";

      const { data: existingMapping } = await serviceClient
        .from(tableName)
        .select("id")
        .eq(idField, id)
        .eq("card_id", cardId)
        .maybeSingle();

      if (!existingMapping) {
        const { error: mappingError } = await serviceClient
          .from(tableName)
          .insert({
            [idField]: id,
            card_id: cardId,
            added_by: user.id,
          });

        if (mappingError) {
          return NextResponse.json(
            { error: mappingError.message },
            { status: 400 }
          );
        }
      }
    }

    // Trigger metadata worker
    if (!cardError || cardError.code === "23505") {
      fetch(
        `${
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        }/api/workers/fetch-metadata`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.WORKER_API_KEY && {
              "x-api-key": process.env.WORKER_API_KEY,
            }),
          },
          body: JSON.stringify({ card_id: cardId }),
        }
      ).catch((err) => {
        console.error("Failed to trigger metadata worker:", err);
      });
    }

    // Return success
    const { data: cardWithAttributions } = await supabase
      .from("cards")
      .select(`
        *,
        attributions:card_attributions (
          id,
          user_id,
          source,
          collection_id,
          created_at,
          user:users!card_attributions_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        )
      `)
      .eq("id", cardId)
      .single();

    return NextResponse.json({
      success: true,
      card: cardWithAttributions,
      card_id: cardId,
    });
  } catch (error) {
    console.error("Error in cards route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}