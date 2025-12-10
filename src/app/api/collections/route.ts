import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createServiceClient } from "@/lib/supabase/api-service";
import {
  rateLimiters,
  checkRateLimit,
  getRateLimitIdentifier,
  getIpAddress,
} from "@/lib/rate-limit";

/**
 * POST /api/collections
 * Create a new collection
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    // Rate limiting: 50 collections/day per user (reasonable limit)
    const ipAddress = getIpAddress(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimitResult = await checkRateLimit(
      rateLimiters.stacks,
      identifier
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error:
            "Rate limit exceeded. You can create up to 50 collections per day.",
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

    const body = await request.json();
    const { title, description, tags, is_public, is_hidden, cover_image_url } =
      body;

    // Check if user is trying to publish and is not a stacqer
    if (is_public === true) {
      const { data: userProfile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (userProfile?.role !== "stacker" && userProfile?.role !== "admin") {
        return NextResponse.json(
          {
            error: "Only Stacqers can publish public collections",
            become_stacker_required: true,
            required_fields: ["display_name", "avatar_url", "short_bio"],
          },
          { status: 403 }
        );
      }
    }

    // Validation
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (title.length > 200) {
      return NextResponse.json(
        { error: "Title must be 200 characters or less" },
        { status: 400 }
      );
    }

    if (description && description.length > 1000) {
      return NextResponse.json(
        { error: "Description must be 1000 characters or less" },
        { status: 400 }
      );
    }

    // Generate slug from title
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 50);

    let slug = baseSlug || `collection-${Date.now()}`;
    let slugExists = true;
    let attempts = 0;

    // Ensure slug is unique
    const serviceClient = createServiceClient();
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

    // Create collection
    const { data: collection, error: collectionError } = await serviceClient
      .from("collections")
      .insert({
        owner_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        slug,
        is_public: is_public ?? false,
        is_hidden: is_hidden ?? false,
        cover_image_url: cover_image_url || null,
        stats: { views: 0, upvotes: 0, saves: 0, comments: 0 },
      })
      .select()
      .single();

    if (collectionError || !collection) {
      console.error("Error creating collection:", collectionError);
      return NextResponse.json(
        { error: collectionError?.message || "Failed to create collection" },
        { status: 500 }
      );
    }

    // Handle tags if provided
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const tagNames = tags
        .map((t: any) =>
          typeof t === "string"
            ? t.trim().toLowerCase()
            : String(t).trim().toLowerCase()
        )
        .filter((t: string) => t.length > 0)
        .slice(0, 10); // Limit to 10 tags

      for (const tagName of tagNames) {
        // Find or create tag
        let { data: tag } = await serviceClient
          .from("tags")
          .select("id")
          .eq("name", tagName)
          .maybeSingle();

        if (!tag) {
          const { data: newTag, error: tagError } = await serviceClient
            .from("tags")
            .insert({ name: tagName })
            .select()
            .maybeSingle();

          if (!tagError && newTag) {
            tag = newTag;
          }
        }

        if (tag) {
          await serviceClient.from("collection_tags").insert({
            collection_id: collection.id,
            tag_id: tag.id,
          });
        }
      }
    }

    // NEW: Notify followers if the collection is public
    if (collection.is_public && !collection.is_hidden) {
      // Run in background to not block response
      (async () => {
        try {
          // 1. Get all followers
          const { data: followers } = await serviceClient
            .from("follows")
            .select("follower_id")
            .eq("following_id", user.id);

          if (followers && followers.length > 0) {
            // 2. Create notification objects
            const notifications = followers.map((follower) => ({
              user_id: follower.follower_id, // The recipient (follower)
              actor_id: user.id, // The actor (creator)
              type: "new_collection",
              data: {
                collection_id: collection.id,
                collection_title: collection.title,
                cover_image_url: collection.cover_image_url,
              },
              read: false,
            }));

            // 3. Batch insert notifications
            const { error: notifError } = await serviceClient
              .from("notifications")
              .insert(notifications);

            if (notifError) {
              console.error(
                "Failed to create follower notifications for new collection:",
                notifError
              );
            }
          }
        } catch (err) {
          console.error("Error in notification background task:", err);
        }
      })();
    }

    return NextResponse.json(collection, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/collections:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/collections
 * Get collections (with optional filtering)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { searchParams } = new URL(request.url);

    const ownerId = searchParams.get("owner_id");
    const isPublic = searchParams.get("is_public");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("collections")
      .select(
        `
        id,
        title,
        description,
        slug,
        cover_image_url,
        is_public,
        is_hidden,
        owner_id,
        stats,
        created_at,
        updated_at,
        owner:users!collections_owner_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (ownerId) {
      query = query.eq("owner_id", ownerId);
    }

    if (isPublic !== null) {
      query = query.eq("is_public", isPublic === "true");
    } else {
      // If not filtering by public, only show public collections to non-owners
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || (ownerId && ownerId !== user.id)) {
        query = query.eq("is_public", true).eq("is_hidden", false);
      }
    }

    const { data: collections, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ collections: collections || [] });
  } catch (error: any) {
    console.error("Error in GET /api/collections:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
