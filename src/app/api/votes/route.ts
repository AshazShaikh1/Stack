import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createServiceClient } from "@/lib/supabase/api-service";
import {
  rateLimiters,
  checkRateLimit,
  getRateLimitIdentifier,
  getIpAddress,
} from "@/lib/rate-limit";
import { checkShadowban } from "@/lib/anti-abuse/fingerprinting";
import { logRankingEvent } from "@/lib/ranking/events";

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

    // Rate limiting: 100 votes/day per user
    const ipAddress = getIpAddress(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimitResult = await checkRateLimit(
      rateLimiters.votes,
      identifier
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. You can cast up to 100 votes per day.",
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

    const { target_type, target_id } = await request.json();

    if (!target_type || !target_id) {
      return NextResponse.json(
        { error: "target_type and target_id are required" },
        { status: 400 }
      );
    }

    // Accept 'stack', 'card', or 'collection'
    if (!["stack", "card", "collection"].includes(target_type)) {
      return NextResponse.json(
        { error: 'target_type must be "stack", "card", or "collection"' },
        { status: 400 }
      );
    }

    // Check if user is shadowbanned
    const serviceClient = createServiceClient();
    const isShadowbanned = await checkShadowban(serviceClient, user.id);
    if (isShadowbanned) {
      return NextResponse.json(
        { error: "Action not allowed" },
        { status: 403 }
      );
    }

    // Account age check (disabled for testing if needed)
    /*
    const { data: userProfile } = await supabase
      .from('users')
      .select('created_at')
      .eq('id', user.id)
      .single();

    if (userProfile) {
      const accountAgeHours = (Date.now() - new Date(userProfile.created_at).getTime()) / (1000 * 60 * 60);
      if (accountAgeHours < 48) {
        return NextResponse.json(
          { error: 'Account must be at least 48 hours old to vote' },
          { status: 403 }
        );
      }
    }
    */

    // Check if vote already exists
    const { data: existingVote } = await serviceClient
      .from("votes")
      .select("id")
      .eq("user_id", user.id)
      .eq("target_type", target_type) // Use raw type for lookup
      .eq("target_id", target_id)
      .maybeSingle();

    // Normalize target_type for events/logic
    const normalizedTargetType =
      target_type === "stack" ? "collection" : target_type;

    if (existingVote) {
      // Remove vote (toggle off)
      await serviceClient.from("votes").delete().eq("id", existingVote.id);

      // Update stats
      await updateVoteStats(serviceClient, target_type, target_id, -1);

      // Log ranking event
      await logRankingEvent(
        normalizedTargetType as "card" | "collection",
        target_id,
        "unvote"
      );

      return NextResponse.json({ success: true, voted: false });
    }

    // Create vote
    // Use normalized type for DB insert if your DB enforces it, otherwise use raw
    // Assuming DB accepts 'collection'
    const { error: voteError } = await serviceClient.from("votes").insert({
      user_id: user.id,
      target_type: normalizedTargetType,
      target_id,
    });

    if (voteError) {
      return NextResponse.json({ error: voteError.message }, { status: 400 });
    }

    // Update stats
    await updateVoteStats(serviceClient, target_type, target_id, 1);

    // Log ranking event
    await logRankingEvent(
      normalizedTargetType as "card" | "collection",
      target_id,
      "upvote"
    );

    return NextResponse.json({ success: true, voted: true });
  } catch (error: any) {
    console.error("Error in votes route:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// FIXED: This function now correctly maps 'stack' to 'collections' table
async function updateVoteStats(
  serviceClient: any,
  targetType: string,
  targetId: string,
  delta: number
) {
  // Map 'stack' (legacy) and 'collection' to the 'collections' table
  const table =
    targetType === "stack" || targetType === "collection"
      ? "collections"
      : "cards";

  // Get current stats
  const { data: target } = await serviceClient
    .from(table)
    .select("stats")
    .eq("id", targetId)
    .single();

  if (target) {
    const stats = target.stats || {};
    const currentUpvotes = (stats.upvotes || 0) + delta;

    await serviceClient
      .from(table)
      .update({
        stats: {
          ...stats,
          upvotes: Math.max(0, currentUpvotes),
        },
      })
      .eq("id", targetId);
  }
}