import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createServiceClient } from "@/lib/supabase/api-service";
import {
  rateLimiters,
  checkRateLimit,
  getRateLimitIdentifier,
  getIpAddress,
} from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ipAddress = getIpAddress(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimitResult = await checkRateLimit(
      rateLimiters.clones,
      identifier
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error:
            "Rate limit exceeded. You can clone up to 10 collections per day.",
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.reset,
        },
        { status: 429 }
      );
    }

    let { data: originalCollection, error: collectionError } = await supabase
      .from("collections")
      .select(
        `
        id,
        title,
        description,
        cover_image_url,
        is_public,
        owner_id
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (!originalCollection && !collectionError) {
      const { data: collectionBySlug, error: slugError } = await supabase
        .from("collections")
        .select(
          `
          id,
          title,
          description,
          cover_image_url,
          is_public,
          owner_id
        `
        )
        .eq("slug", id)
        .maybeSingle();

      originalCollection = collectionBySlug;
      collectionError = slugError;
    }

    if (collectionError || !originalCollection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    if (!originalCollection.is_public) {
      return NextResponse.json(
        { error: "Only public collections can be cloned" },
        { status: 403 }
      );
    }

    if (originalCollection.owner_id === user.id) {
      return NextResponse.json(
        { error: "You cannot clone your own collection" },
        { status: 400 }
      );
    }

    const { data: existingClone } = await supabase
      .from("clones")
      .select("id")
      .eq("cloner_id", user.id)
      .or(`original_stack_id.eq.${id},original_collection_id.eq.${id}`)
      .maybeSingle();

    if (existingClone) {
      return NextResponse.json(
        { error: "You have already cloned this collection" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    const baseSlug = originalCollection.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 50);

    let slug = `${baseSlug}-${Date.now()}`;
    let slugExists = true;
    let attempts = 0;

    while (slugExists && attempts < 10) {
      const { data: existing } = await serviceClient
        .from("collections")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (!existing) {
        slugExists = false;
      } else {
        slug = `${baseSlug}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 9)}`;
        attempts++;
      }
    }

    const { data: clonedCollection, error: createError } = await serviceClient
      .from("collections")
      .insert({
        owner_id: user.id,
        title: `${originalCollection.title} (Clone)`,
        description: originalCollection.description,
        cover_image_url: originalCollection.cover_image_url,
        slug,
        is_public: false,
        is_hidden: false,
        stats: { views: 0, upvotes: 0, saves: 0, comments: 0 },
      })
      .select()
      .single();

    if (createError || !clonedCollection) {
      console.error("Error creating cloned collection:", createError);
      return NextResponse.json(
        { error: "Failed to create cloned collection" },
        { status: 500 }
      );
    }

    const { data: originalTags } = await supabase
      .from("collection_tags")
      .select("tag_id")
      .eq("collection_id", id);

    if (originalTags && originalTags.length > 0) {
      const tagMappings = originalTags.map((ct: any) => ({
        collection_id: clonedCollection.id,
        tag_id: ct.tag_id,
      }));

      await serviceClient.from("collection_tags").insert(tagMappings);
    }

    const { data: originalCards } = await supabase
      .from("collection_cards")
      .select("card_id")
      .eq("collection_id", id);

    if (originalCards && originalCards.length > 0) {
      const cardMappings = originalCards.map((cc: any) => ({
        collection_id: clonedCollection.id,
        card_id: cc.card_id,
        added_by: user.id,
      }));

      await serviceClient.from("collection_cards").insert(cardMappings);
    }

    await serviceClient.from("clones").insert({
      original_collection_id: id,
      new_collection_id: clonedCollection.id,
      cloner_id: user.id,
    });

    // --- NOTIFICATION LOGIC START ---
    // Notify the original collection owner
    (async () => {
      try {
        if (
          originalCollection.owner_id &&
          originalCollection.owner_id !== user.id
        ) {
          await serviceClient.from("notifications").insert({
            user_id: originalCollection.owner_id,
            actor_id: user.id,
            type: "clone",
            data: {
              collection_id: id, // Link to the original collection
              collection_title: originalCollection.title,
            },
            read: false,
          });
        }
      } catch (err) {
        console.error("Error creating clone notification:", err);
      }
    })();
    // --- NOTIFICATION LOGIC END ---

    return NextResponse.json({
      success: true,
      collection: {
        id: clonedCollection.id,
        slug: clonedCollection.slug,
        title: clonedCollection.title,
      },
    });
  } catch (error) {
    console.error("Error in clone route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
