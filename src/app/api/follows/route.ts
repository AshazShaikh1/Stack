import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { createServiceClient } from '@/lib/supabase/api-service';

/**
 * POST /api/follows
 * Follow a user
 * Body: { following_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { following_id } = await request.json();

    if (!following_id) {
      return NextResponse.json(
        { error: 'following_id is required' },
        { status: 400 }
      );
    }

    // Prevent self-follows
    if (user.id === following_id) {
      return NextResponse.json(
        { error: 'Cannot follow yourself' },
        { status: 400 }
      );
    }

    // Check if user exists
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', following_id)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if already following
    const { data: existingFollow, error: checkError } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', following_id)
      .maybeSingle();

    // If table doesn't exist, provide helpful error
    if (checkError && checkError.code === 'PGRST205') {
      console.error('Follows table does not exist. Please run migration 017_follows_table.sql in Supabase.');
      return NextResponse.json(
        { 
          error: 'Follow system not set up. Please run the migration in Supabase SQL Editor.',
          details: 'Migration file: supabase/migrations/017_follows_table.sql'
        },
        { status: 503 }
      );
    }

    if (checkError) {
      console.error('Error checking follow status:', checkError);
      return NextResponse.json(
        { error: 'Failed to check follow status' },
        { status: 500 }
      );
    }

    if (existingFollow) {
      return NextResponse.json(
        { error: 'Already following this user' },
        { status: 400 }
      );
    }

    // Create follow relationship
    const serviceClient = createServiceClient();
    const { data: follow, error: followError } = await serviceClient
      .from('follows')
      .insert({
        follower_id: user.id,
        following_id: following_id,
      })
      .select()
      .single();

    if (followError) {
      console.error('Error creating follow:', followError);
      
      // If table doesn't exist, provide helpful error
      if (followError.code === 'PGRST205') {
        return NextResponse.json(
          { 
            error: 'Follow system not set up. Please run the migration in Supabase SQL Editor.',
            details: 'Migration file: supabase/migrations/017_follows_table.sql'
          },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to follow user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      follow,
    });
  } catch (error) {
    console.error('Error in follows route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

