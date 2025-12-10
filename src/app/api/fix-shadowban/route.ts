import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/api-service";

export async function GET() {
  try {
    const supabase = createServiceClient();

    // 1. Reset quality_score for users where it is NULL OR 0
    // This is the critical fix for the "Action not allowed" error
    const { error: scoreError } = await supabase
      .from("users")
      .update({ quality_score: 30 }) // Set to neutral score
      .or("quality_score.is.null,quality_score.eq.0");

    if (scoreError) throw scoreError;

    // 2. Fetch all users to check metadata for stuck ban flags
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, metadata");

    if (userError) throw userError;

    let unbannedCount = 0;

    // 3. Remove shadowban flag from metadata
    for (const user of users || []) {
      if (user.metadata?.shadowbanned) {
        const newMetadata = { ...user.metadata };

        // Remove ban flags
        delete newMetadata.shadowbanned;
        delete newMetadata.shadowban_reason;
        delete newMetadata.shadowbanned_at;

        // Update user
        await supabase
          .from("users")
          .update({ metadata: newMetadata })
          .eq("id", user.id);

        unbannedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed null/zero scores and cleaned metadata for ${unbannedCount} users.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
