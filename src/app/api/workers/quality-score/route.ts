import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/api-service";

/**
 * POST /api/workers/quality-score
 * Calculate and update quality scores for all users
 * Should be called periodically (e.g., daily via GitHub Actions)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is called from an authorized source
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.WORKER_API_KEY;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const results: Record<string, any> = {
      updated: 0,
      errors: [],
    };

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id");

    if (usersError || !users) {
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    // Calculate quality score for each user
    for (const user of users) {
      try {
        const qualityScore = await calculateQualityScore(supabase, user.id);

        // Update user's quality score
        const { error: updateError } = await supabase
          .from("users")
          .update({ quality_score: qualityScore })
          .eq("id", user.id);

        if (updateError) {
          results.errors.push({ user_id: user.id, error: updateError.message });
        } else {
          results.updated++;
        }
      } catch (error: any) {
        results.errors.push({ user_id: user.id, error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in quality score worker:", error);
    return NextResponse.json(
      { error: "Failed to calculate quality scores" },
      { status: 500 }
    );
  }
}

/**
 * Calculate quality score for a user (0-100)
 * Based on:
 * - Account age
 * - Content quality (collections, cards)
 * - Engagement (upvotes received, comments)
 * - Reports received (negative)
 * - Spam/abuse flags (negative)
 */
async function calculateQualityScore(
  supabase: any,
  userId: string
): Promise<number> {
  let score = 50; // Start with neutral score

  // Get user account age
  const { data: user } = await supabase
    .from("users")
    .select("created_at")
    .eq("id", userId)
    .single();

  if (user) {
    const accountAgeDays =
      (Date.now() - new Date(user.created_at).getTime()) /
      (1000 * 60 * 60 * 24);
    // Older accounts get bonus (max +10 points for 30+ days)
    score += Math.min(accountAgeDays / 3, 10);
  }

  // Get user's collections count and quality
  const { count: collectionsCount } = await supabase
    .from("collections")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("is_public", true);

  // Get collections with upvotes
  const { data: collections } = await supabase
    .from("collections")
    .select("stats")
    .eq("owner_id", userId)
    .eq("is_public", true);

  let totalUpvotes = 0;
  if (collections) {
    totalUpvotes = collections.reduce((sum: number, collection: any) => {
      return sum + (collection.stats?.upvotes || 0);
    }, 0);
  }

  // Quality based on collections and engagement
  score += Math.min((collectionsCount || 0) * 2, 20); // Max +20 for collections
  score += Math.min(totalUpvotes / 10, 15); // Max +15 for upvotes

  // Get cards created
  const { count: cardsCount } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("created_by", userId);

  score += Math.min((cardsCount || 0) * 0.5, 10); // Max +10 for cards

  // Get reports received (negative impact)
  const { count: reportsCount } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("target_type", "user")
    .eq("target_id", userId)
    .eq("status", "resolved");

  score -= (reportsCount || 0) * 5; // -5 per resolved report

  // Get comments count (engagement)
  const { count: commentsCount } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("deleted", false);

  score += Math.min((commentsCount || 0) * 0.2, 5); // Max +5 for comments

  // Clamp score between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}
