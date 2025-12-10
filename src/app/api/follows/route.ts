import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createServiceClient } from "@/lib/supabase/api-service";

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

    const { following_id } = await request.json();

    if (!following_id) {
      return NextResponse.json(
        { error: "following_id is required" },
        { status: 400 }
      );
    }

    if (user.id === following_id) {
      return NextResponse.json(
        { error: "Cannot follow yourself" },
        { status: 400 }
      );
    }

    const { data: targetUser, error: userError } = await supabase
      .from("users")
      .select("id, username")
      .eq("id", following_id)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: existingFollow, error: checkError } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", following_id)
      .maybeSingle();

    if (checkError && checkError.code === "PGRST205") {
      console.error("Follows table does not exist.");
      return NextResponse.json({ error: "System error" }, { status: 503 });
    }

    if (existingFollow) {
      return NextResponse.json(
        { error: "Already following this user" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();
    const { data: follow, error: followError } = await serviceClient
      .from("follows")
      .insert({
        follower_id: user.id,
        following_id: following_id,
      })
      .select()
      .single();

    if (followError) {
      console.error("Error creating follow:", followError);
      return NextResponse.json(
        { error: "Failed to follow user" },
        { status: 500 }
      );
    }

    // --- NOTIFICATION LOGIC START ---
    // Notify the user who was followed
    (async () => {
      try {
        await serviceClient.from("notifications").insert({
          user_id: following_id, // The person being followed
          actor_id: user.id, // The follower
          type: "follow",
          data: {},
          read: false,
        });
      } catch (err) {
        console.error("Error creating follow notification:", err);
      }
    })();
    // --- NOTIFICATION LOGIC END ---

    return NextResponse.json({
      success: true,
      follow,
    });
  } catch (error) {
    console.error("Error in follows route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
