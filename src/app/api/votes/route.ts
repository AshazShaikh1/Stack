import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { createServiceClient } from '@/lib/supabase/api-service';

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

    const { target_type, target_id } = await request.json();

    if (!target_type || !target_id) {
      return NextResponse.json(
        { error: 'target_type and target_id are required' },
        { status: 400 }
      );
    }

    if (!['stack', 'card'].includes(target_type)) {
      return NextResponse.json(
        { error: 'target_type must be "stack" or "card"' },
        { status: 400 }
      );
    }

    // Check account age (48 hours required)
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

    const serviceClient = createServiceClient();

    // Check if vote already exists
    const { data: existingVote } = await serviceClient
      .from('votes')
      .select('id')
      .eq('user_id', user.id)
      .eq('target_type', target_type)
      .eq('target_id', target_id)
      .maybeSingle();

    if (existingVote) {
      // Remove vote (toggle off)
      await serviceClient
        .from('votes')
        .delete()
        .eq('id', existingVote.id);

      // Update stats
      await updateVoteStats(serviceClient, target_type, target_id, -1);

      return NextResponse.json({ success: true, voted: false });
    }

    // Create vote
    const { error: voteError } = await serviceClient
      .from('votes')
      .insert({
        user_id: user.id,
        target_type,
        target_id,
      });

    if (voteError) {
      return NextResponse.json(
        { error: voteError.message },
        { status: 400 }
      );
    }

    // Update stats
    await updateVoteStats(serviceClient, target_type, target_id, 1);

    return NextResponse.json({ success: true, voted: true });
  } catch (error) {
    console.error('Error in votes route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function updateVoteStats(
  serviceClient: any,
  targetType: string,
  targetId: string,
  delta: number
) {
  const table = targetType === 'stack' ? 'stacks' : 'cards';
  
  // Get current stats
  const { data: target } = await serviceClient
    .from(table)
    .select('stats')
    .eq('id', targetId)
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
      .eq('id', targetId);
  }
}

