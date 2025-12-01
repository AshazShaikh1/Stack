import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { createServiceClient } from '@/lib/supabase/api-service';
import { rateLimiters, checkRateLimit, getRateLimitIdentifier, getIpAddress } from '@/lib/rate-limit';

/**
 * POST /api/saves
 * Save or unsave a stack
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

    // Rate limiting: 100 saves/day per user
    const ipAddress = getIpAddress(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimitResult = await checkRateLimit(rateLimiters.saves, identifier);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. You can save up to 100 stacks per day.',
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.reset,
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          },
        }
      );
    }

    const { stack_id } = await request.json();

    if (!stack_id) {
      return NextResponse.json(
        { error: 'stack_id is required' },
        { status: 400 }
      );
    }

    // Verify stack exists and is accessible
    const { data: stack, error: stackError } = await supabase
      .from('stacks')
      .select('id, is_public, owner_id')
      .eq('id', stack_id)
      .single();

    if (stackError || !stack) {
      return NextResponse.json(
        { error: 'Stack not found' },
        { status: 404 }
      );
    }

    // Check if stack is accessible (public or owned by user)
    if (!stack.is_public && stack.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'You cannot save private stacks' },
        { status: 403 }
      );
    }

    const serviceClient = createServiceClient();

    // Check if already saved
    const { data: existingSave } = await serviceClient
      .from('saves')
      .select('id')
      .eq('user_id', user.id)
      .eq('stack_id', stack_id)
      .maybeSingle();

    if (existingSave) {
      // Unsave (delete)
      await serviceClient
        .from('saves')
        .delete()
        .eq('id', existingSave.id);

      return NextResponse.json({ success: true, saved: false });
    } else {
      // Save (insert)
      const { error: saveError } = await serviceClient
        .from('saves')
        .insert({
          user_id: user.id,
          stack_id,
        });

      if (saveError) {
        return NextResponse.json(
          { error: saveError.message },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, saved: true });
    }
  } catch (error) {
    console.error('Error in saves route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/saves
 * Get saved stacks for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get saved stacks
    const { data: saves, error } = await supabase
      .from('saves')
      .select(`
        id,
        created_at,
        stack:stacks!saves_stack_id_fkey (
          id,
          title,
          description,
          slug,
          cover_image_url,
          is_public,
          stats,
          owner_id,
          created_at,
          owner:users!stacks_owner_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ saves: saves || [] });
  } catch (error) {
    console.error('Error in saves GET route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

