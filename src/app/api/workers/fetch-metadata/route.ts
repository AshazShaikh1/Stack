import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/api-service";
import { fetchMetadata } from "@/lib/metadata/extractor";
import { uploadThumbnail } from "@/lib/metadata/thumbnail";

/**
 * POST /api/workers/fetch-metadata
 * Metadata fetcher worker
 * Processes metadata extraction jobs for cards
 * * Body:
 * - card_id: string (optional) - Process specific card
 * - url: string (optional) - Process specific URL
 * - limit: number (optional) - Number of jobs to process (default: 10)
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add API key authentication for security
    const apiKey = request.headers.get("x-api-key");
    const expectedApiKey = process.env.WORKER_API_KEY;

    if (expectedApiKey && apiKey !== expectedApiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const body = await request.json().catch(() => ({}));
    const { card_id, url, limit = 10 } = body;

    // If specific card_id or url provided, process that
    if (card_id) {
      return await processCard(supabase, card_id);
    }

    if (url) {
      return await processUrl(supabase, url);
    }

    // Otherwise, process a batch of pending cards
    // Get cards that need metadata (no title/description or missing thumbnail)
    const { data: cards, error: cardsError } = await supabase
      .from("cards")
      .select(
        "id, canonical_url, title, description, thumbnail_url, created_by"
      )
      .or("title.is.null,description.is.null,thumbnail_url.is.null")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (cardsError) {
      console.error("Error fetching cards:", cardsError);
      return NextResponse.json(
        { error: "Failed to fetch cards" },
        { status: 500 }
      );
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No cards need metadata processing",
      });
    }

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each card
    for (const card of cards) {
      try {
        if (!card.canonical_url) {
          results.failed++;
          results.errors.push(`Card ${card.id}: No URL`);
          continue;
        }

        const metadata = await fetchMetadata(card.canonical_url);

        // Update card with metadata
        const updateData: any = {};

        if (!card.title && metadata.title) {
          updateData.title = metadata.title;
        }

        if (!card.description && metadata.description) {
          updateData.description = metadata.description;
        }

        // Update domain if needed
        if (metadata.domain) {
          updateData.domain = metadata.domain;
        }

        // Update canonical URL if it changed (shouldn't happen, but just in case)
        if (metadata.canonicalUrl !== card.canonical_url) {
          updateData.canonical_url = metadata.canonicalUrl;
        }

        // Store metadata in metadata JSONB field
        // Cast card to any to access metadata property which might not be on the default type
        const existingMetadata = (card as any).metadata || {};
        updateData.metadata = {
          ...metadata.metadata,
          ...existingMetadata, // Preserve existing metadata (like affiliate_url)
        };

        // Process Amazon affiliate links in the background (non-blocking)
        // This ensures metadata processing doesn't slow down
        const processAffiliateLink = async () => {
          try {
            const {
              isAmazonLink,
              addAmazonAffiliateTag,
              getAmazonAffiliateConfig,
            } = await import("@/lib/affiliate/amazon");
            const config = getAmazonAffiliateConfig();

            if (config && isAmazonLink(card.canonical_url)) {
              const affiliateUrl = addAmazonAffiliateTag(
                card.canonical_url,
                config
              );

              if (affiliateUrl && affiliateUrl !== card.canonical_url) {
                // Update with affiliate URL
                // Use try/catch instead of .then().catch() to avoid TS PromiseLike errors
                try {
                  await supabase
                    .from("cards")
                    .update({
                      metadata: {
                        ...updateData.metadata,
                        affiliate_url: affiliateUrl,
                        is_amazon_product: true,
                      },
                    })
                    .eq("id", card.id);
                } catch {
                  // Silently fail
                }
              }
            }
          } catch (error) {
            // Silently fail - affiliate processing is optional
          }
        };

        // Start affiliate processing but don't wait
        processAffiliateLink();

        // Upload thumbnail if we have one and card doesn't
        if (metadata.thumbnailUrl && !card.thumbnail_url && card.created_by) {
          const uploadedThumbnail = await uploadThumbnail(
            metadata.thumbnailUrl,
            card.id,
            card.created_by
          );

          if (uploadedThumbnail) {
            updateData.thumbnail_url = uploadedThumbnail;
          }
        } else if (metadata.thumbnailUrl && !card.thumbnail_url) {
          // Use external thumbnail URL if upload fails
          updateData.thumbnail_url = metadata.thumbnailUrl;
        }

        const { error: updateError } = await supabase
          .from("cards")
          .update(updateData)
          .eq("id", card.id);

        if (updateError) {
          throw updateError;
        }

        results.succeeded++;
      } catch (error: any) {
        console.error(`Error processing card ${card.id}:`, error);
        results.failed++;
        results.errors.push(
          `Card ${card.id}: ${error.message || "Unknown error"}`
        );
      }

      results.processed++;
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error: any) {
    console.error("Error in metadata fetcher worker:", error);
    return NextResponse.json(
      { error: error.message || "Metadata fetcher failed" },
      { status: 500 }
    );
  }
}

/**
 * Process a specific card
 */
async function processCard(supabase: any, cardId: string) {
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select(
      "id, canonical_url, title, description, thumbnail_url, created_by, metadata"
    )
    .eq("id", cardId)
    .single();

  if (cardError || !card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  if (!card.canonical_url) {
    return NextResponse.json({ error: "Card has no URL" }, { status: 400 });
  }

  try {
    const metadata = await fetchMetadata(card.canonical_url);

    const updateData: any = {
      title: metadata.title || card.title,
      description: metadata.description || card.description,
      domain: metadata.domain,
      metadata: {
        ...metadata.metadata,
        ...(card.metadata || {}),
      },
    };

    // Upload thumbnail if we have one
    if (metadata.thumbnailUrl && card.created_by) {
      const uploadedThumbnail = await uploadThumbnail(
        metadata.thumbnailUrl,
        card.id,
        card.created_by
      );

      if (uploadedThumbnail) {
        updateData.thumbnail_url = uploadedThumbnail;
      } else {
        updateData.thumbnail_url = metadata.thumbnailUrl;
      }
    }

    const { error: updateError } = await supabase
      .from("cards")
      .update(updateData)
      .eq("id", card.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      card_id: card.id,
      metadata,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process card" },
      { status: 500 }
    );
  }
}

/**
 * Process a specific URL (for testing or manual processing)
 */
async function processUrl(supabase: any, url: string) {
  try {
    // Import canonicalizeUrl here to avoid circular dependencies if it was in imports
    const { canonicalizeUrl } = await import("@/lib/metadata/extractor");

    const metadata = await fetchMetadata(url);
    const canonicalUrl = canonicalizeUrl(url);

    // Check if card already exists
    const { data: existingCard } = await supabase
      .from("cards")
      .select("id, canonical_url")
      .eq("canonical_url", canonicalUrl)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      url,
      canonical_url: canonicalUrl,
      metadata,
      existing_card: existingCard ? existingCard.id : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process URL" },
      { status: 500 }
    );
  }
}
