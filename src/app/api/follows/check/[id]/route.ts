import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';

/**
 * GET /api/follows/check/[id]
 * Check if current user follows the specified user (id is the following_id)
 * Returns: { isFollowing: boolean, followerCount: number, followingCount: number }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: following_id } = await params;
    const supabase = await createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if following
    const { data: follow, error: followCheckError } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', following_id)
      .maybeSingle();

    // If table doesn't exist, return default values
    if (followCheckError && followCheckError.code === 'PGRST205') {
      return NextResponse.json({
        isFollowing: false,
        followerCount: 0,
        followingCount: 0,
      });
    }

    // Get follower count
    const { count: followerCount } = await supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', following_id);

    // Get following count
    const { count: followingCount } = await supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', following_id);

    return NextResponse.json({
      isFollowing: !!follow,
      followerCount: followerCount || 0,
      followingCount: followingCount || 0,
    });
  } catch (error) {
    console.error('Error in follow check route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

