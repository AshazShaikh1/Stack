import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createServiceClient } from "@/lib/supabase/api-service";
import {
  rateLimiters,
  checkRateLimit,
  getRateLimitIdentifier,
  getIpAddress,
} from "@/lib/rate-limit";
import { moderateComment } from "@/lib/moderation/comment-moderation";
import { logRankingEvent } from "@/lib/ranking/events";
import { checkShadowban } from "@/lib/anti-abuse/fingerprinting";
import { cachedJsonResponse } from "@/lib/cache/headers";

// GET: Fetch comments for a target (stack or card)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get("target_type");
    const targetId = searchParams.get("target_id");

    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: "target_type and target_id are required" },
        { status: 400 }
      );
    }

    if (!["stack", "card", "collection"].includes(targetType)) {
      return NextResponse.json(
        { error: 'target_type must be "collection", "stack", or "card"' },
        { status: 400 }
      );
    }

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    const isAdmin = currentUser
      ? await checkIsAdmin(supabase, currentUser.id)
      : false;

    let query = supabase
      .from("comments")
      .select(
        `
        id,
        user_id,
        target_type,
        target_id,
        parent_id,
        content,
        deleted,
        hidden,
        created_at,
        updated_at,
        user:users!comments_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .eq("target_id", targetId)
      .eq("deleted", false);

    if (targetType === "stack" || targetType === "collection") {
      query = query.in("target_type", ["stack", "collection"]);
    } else {
      query = query.eq("target_type", targetType);
    }

    if (!isAdmin && currentUser) {
      query = query.or(`hidden.eq.false,user_id.eq.${currentUser.id}`);
    } else if (!isAdmin && !currentUser) {
      query = query.eq("hidden", false);
    }

    const { data: comments, error } = await query.order("created_at", {
      ascending: true,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const threadedComments = buildThreadedComments(comments || []);
    return cachedJsonResponse({ comments: threadedComments }, "USER_SPECIFIC");
  } catch (error) {
    console.error("Error in comments GET route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Create a new comment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    const isShadowbanned = await checkShadowban(serviceClient, user.id);
    if (isShadowbanned) {
      return NextResponse.json(
        { error: "Action not allowed" },
        { status: 403 }
      );
    }

    const ipAddress = getIpAddress(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimitResult = await checkRateLimit(
      rateLimiters.comments,
      identifier
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error:
            "Rate limit exceeded. You can post up to 3 comments per minute.",
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.reset,
        },
        { status: 429 }
      );
    }

    const { target_type, target_id, parent_id, content } = await request.json();

    if (!target_type || !target_id || !content) {
      return NextResponse.json(
        { error: "target_type, target_id, and content are required" },
        { status: 400 }
      );
    }

    let dbTargetType = target_type;
    if (target_type === "stack") dbTargetType = "collection";

    if (!["stack", "card", "collection"].includes(target_type)) {
      return NextResponse.json(
        { error: 'target_type must be "collection", "stack", or "card"' },
        { status: 400 }
      );
    }

    if (content.trim().length === 0 || content.length > 5000) {
      return NextResponse.json(
        { error: "Comment must be between 1 and 5000 characters" },
        { status: 400 }
      );
    }

    if (parent_id) {
      const { data: parentComment } = await supabase
        .from("comments")
        .select("id, parent_id")
        .eq("id", parent_id)
        .single();

      if (!parentComment) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 404 }
        );
      }

      const depth = await getCommentDepth(supabase, parent_id);
      if (depth >= 4) {
        return NextResponse.json(
          { error: "Maximum nesting depth (4 levels) reached" },
          { status: 400 }
        );
      }
    }

    const moderationResult = await moderateComment(content.trim());
    const shouldHide = moderationResult.shouldHide;

    const { data: newComment, error: commentError } = await serviceClient
      .from("comments")
      .insert({
        user_id: user.id,
        target_type: dbTargetType,
        target_id,
        parent_id: parent_id || null,
        content: content.trim(),
        hidden: shouldHide,
        moderation_metadata: {
          toxicity_score: moderationResult.toxicityScore,
          categories: moderationResult.categories,
          moderated_at: new Date().toISOString(),
        },
      })
      .select(
        `
        id,
        user_id,
        target_type,
        target_id,
        parent_id,
        content,
        deleted,
        created_at,
        updated_at,
        user:users!comments_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .single();

    if (commentError) {
      return NextResponse.json(
        { error: commentError.message },
        { status: 400 }
      );
    }

    await updateCommentStats(serviceClient, dbTargetType, target_id, 1);
    await logRankingEvent(
      dbTargetType === "card" ? "card" : "collection",
      target_id,
      "comment"
    );

    // --- NOTIFICATION LOGIC START ---
    (async () => {
      try {
        const table = dbTargetType === "collection" ? "collections" : "cards";
        const ownerField =
          dbTargetType === "collection" ? "owner_id" : "created_by";

        // 1. Notify Post Owner
        const { data: targetItem } = await serviceClient
          .from(table)
          .select(`id, title, ${ownerField}`)
          .eq("id", target_id)
          .single();

        if (targetItem) {
          // Cast targetItem to any to allow dynamic key access
          const item = targetItem as any;
          const ownerId = item[ownerField];

          if (ownerId && ownerId !== user.id) {
            await serviceClient.from("notifications").insert({
              user_id: ownerId,
              actor_id: user.id,
              type: "comment",
              data: {
                [`${dbTargetType}_id`]: target_id,
                [`${dbTargetType}_title`]: targetItem.title,
                comment_id: newComment.id,
                comment_content: content.trim(),
              },
              read: false,
            });
          }
        }

        // 2. Notify Parent Comment Author (if reply)
        if (parent_id) {
          const { data: parentComment } = await serviceClient
            .from("comments")
            .select("user_id")
            .eq("id", parent_id)
            .single();

          // Avoid double notification if parent author is same as post owner
          const item = targetItem as any;
          const postOwnerId = item?.[ownerField];

          if (
            parentComment &&
            parentComment.user_id !== user.id &&
            parentComment.user_id !== postOwnerId
          ) {
            await serviceClient.from("notifications").insert({
              user_id: parentComment.user_id,
              actor_id: user.id,
              type: "comment", // You might want to add 'reply' type later, but 'comment' works
              data: {
                [`${dbTargetType}_id`]: target_id,
                [`${dbTargetType}_title`]: targetItem?.title,
                comment_id: newComment.id,
                comment_content: content.trim(),
              },
              read: false,
            });
          }
        }
      } catch (err) {
        console.error("Error creating comment notification:", err);
      }
    })();
    // --- NOTIFICATION LOGIC END ---

    return NextResponse.json({ comment: newComment });
  } catch (error) {
    console.error("Error in comments POST route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function buildThreadedComments(comments: any[]): any[] {
  const commentMap = new Map();
  const rootComments: any[] = [];
  comments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });
  comments.forEach((comment) => {
    const commentWithReplies = commentMap.get(comment.id);
    if (comment.parent_id) {
      const parent = commentMap.get(comment.parent_id);
      if (parent) parent.replies.push(commentWithReplies);
    } else {
      rootComments.push(commentWithReplies);
    }
  });
  return rootComments;
}

async function getCommentDepth(
  supabase: any,
  commentId: string
): Promise<number> {
  let depth = 0;
  let currentId: string | null = commentId;
  while (currentId && depth < 5) {
    const {
      data: comment,
    }: { data: { parent_id: string | null } | null; error: any } =
      await supabase
        .from("comments")
        .select("parent_id")
        .eq("id", currentId)
        .single();
    if (!comment || !comment.parent_id) break;
    depth++;
    currentId = comment.parent_id;
  }
  return depth;
}

async function checkIsAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();
  return user?.role === "admin";
}

async function updateCommentStats(
  serviceClient: any,
  targetType: string,
  targetId: string,
  delta: number
) {
  const table =
    targetType === "stack" || targetType === "collection"
      ? "collections"
      : "cards";

  try {
    const { data: target } = await serviceClient
      .from(table)
      .select("stats")
      .eq("id", targetId)
      .single();

    if (target) {
      const stats = target.stats || {};
      const currentComments = stats.comments || 0;
      const newComments = Math.max(0, currentComments + delta);

      await serviceClient
        .from(table)
        .update({
          stats: {
            ...stats,
            comments: newComments,
          },
        })
        .eq("id", targetId);
    }
  } catch (err) {
    console.error(`Error updating stats for table ${table}:`, err);
  }
}
