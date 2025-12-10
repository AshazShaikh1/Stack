import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { createServiceClient } from '@/lib/supabase/api-service';
import { rateLimiters, checkRateLimit, getRateLimitIdentifier, getIpAddress } from '@/lib/rate-limit';
import { moderateComment } from '@/lib/moderation/comment-moderation';
import { logRankingEvent } from '@/lib/ranking/events';
import { checkShadowban } from '@/lib/anti-abuse/fingerprinting';
import { cachedJsonResponse } from '@/lib/cache/headers';

// GET: Fetch comments for a target (stack or card)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('target_type');
    const targetId = searchParams.get('target_id');

    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: 'target_type and target_id are required' },
        { status: 400 }
      );
    }

    // Accept 'collection' (new) or 'stack' (legacy) for backward compatibility
    const normalizedTargetType = targetType === 'collection' ? 'collection' : targetType === 'stack' ? 'collection' : targetType;
    
    if (!['stack', 'card', 'collection'].includes(targetType)) {
      return NextResponse.json(
        { error: 'target_type must be "collection", "stack", or "card"' },
        { status: 400 }
      );
    }

    // Get current user to check if they can see hidden comments
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const isAdmin = currentUser ? await checkIsAdmin(supabase, currentUser.id) : false;

    // Fetch all comments for this target
    // Hide moderated comments from non-admins and non-authors
    let query = supabase
      .from('comments')
      .select(`
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
      `)
      .eq('target_type', normalizedTargetType)
      .eq('target_id', targetId)
      .eq('deleted', false);

    // Filter out hidden comments unless user is admin or comment author
    if (!isAdmin && currentUser) {
      query = query.or(`hidden.eq.false,user_id.eq.${currentUser.id}`);
    } else if (!isAdmin && !currentUser) {
      query = query.eq('hidden', false);
    }

    const { data: comments, error } = await query.order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Build threaded structure (max 4 levels)
    const threadedComments = buildThreadedComments(comments || []);

    // Comments are user-specific but can be cached briefly
    return cachedJsonResponse({ comments: threadedComments }, 'USER_SPECIFIC');
  } catch (error) {
    console.error('Error in comments GET route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new comment
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

    // Check if user is shadowbanned
    const serviceClient = createServiceClient();
    const isShadowbanned = await checkShadowban(serviceClient, user.id);
    if (isShadowbanned) {
      return NextResponse.json(
        { error: 'Action not allowed' },
        { status: 403 }
      );
    }

    // Rate limiting: 3 comments/min per user (PRD requirement)
    const ipAddress = getIpAddress(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimitResult = await checkRateLimit(rateLimiters.comments, identifier);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. You can post up to 3 comments per minute.',
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

    const { target_type, target_id, parent_id, content } = await request.json();

    if (!target_type || !target_id || !content) {
      return NextResponse.json(
        { error: 'target_type, target_id, and content are required' },
        { status: 400 }
      );
    }

    // Accept 'collection' (new) or 'stack' (legacy) for backward compatibility
    const normalizedTargetType = target_type === 'collection' ? 'collection' : target_type === 'stack' ? 'collection' : target_type;
    
    if (!['stack', 'card', 'collection'].includes(target_type)) {
      return NextResponse.json(
        { error: 'target_type must be "collection", "stack", or "card"' },
        { status: 400 }
      );
    }

    // Validate content length
    if (content.trim().length === 0 || content.length > 5000) {
      return NextResponse.json(
        { error: 'Comment must be between 1 and 5000 characters' },
        { status: 400 }
      );
    }

    // If parent_id is provided, validate nesting depth (max 4 levels)
    if (parent_id) {
      const { data: parentComment } = await supabase
        .from('comments')
        .select('id, parent_id')
        .eq('id', parent_id)
        .single();

      if (!parentComment) {
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        );
      }

      // Check nesting depth
      const depth = await getCommentDepth(supabase, parent_id);
      if (depth >= 4) {
        return NextResponse.json(
          { error: 'Maximum nesting depth (4 levels) reached' },
          { status: 400 }
        );
      }
    }

    // Moderate comment content
    const moderationResult = await moderateComment(content.trim());
    const shouldHide = moderationResult.shouldHide;
    
    // Create comment (with hidden flag if toxic)
    const { data: newComment, error: commentError } = await serviceClient
      .from('comments')
      .insert({
        user_id: user.id,
        target_type: normalizedTargetType,
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
      .select(`
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
      `)
      .single();

    if (commentError) {
      return NextResponse.json(
        { error: commentError.message },
        { status: 400 }
      );
    }

    // Update comment stats
    await updateCommentStats(serviceClient, normalizedTargetType, target_id, 1);

    // Log ranking event
    await logRankingEvent(normalizedTargetType as 'card' | 'collection', target_id, 'comment');

    return NextResponse.json({ comment: newComment });
  } catch (error) {
    console.error('Error in comments POST route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to build threaded comment structure
function buildThreadedComments(comments: any[]): any[] {
  const commentMap = new Map();
  const rootComments: any[] = [];

  // First pass: create map of all comments
  comments.forEach(comment => {
    commentMap.set(comment.id, {
      ...comment,
      replies: [],
    });
  });

  // Second pass: build tree structure
  comments.forEach(comment => {
    const commentWithReplies = commentMap.get(comment.id);
    if (comment.parent_id) {
      const parent = commentMap.get(comment.parent_id);
      if (parent) {
        parent.replies.push(commentWithReplies);
      }
    } else {
      rootComments.push(commentWithReplies);
    }
  });

  return rootComments;
}

// Helper function to calculate comment depth
async function getCommentDepth(supabase: any, commentId: string): Promise<number> {
  let depth = 0;
  let currentId: string | null = commentId;

  while (currentId && depth < 5) {
    const { data: comment }: { data: any, error: any } = await supabase
      .from('comments')
      .select('parent_id')
      .eq('id', currentId)
      .single();

    if (!comment || !comment.parent_id) {
      break;
    }

    depth++;
    currentId = comment.parent_id;
  }

  return depth;
}

// Helper function to check if user is admin
async function checkIsAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  
  return user?.role === 'admin';
}

// Helper function to update comment stats
async function updateCommentStats(
  serviceClient: any,
  targetType: string,
  targetId: string,
  delta: number
) {
  // Normalize targetType: 'stack' or 'collection' both map to 'collections' table
  const table = (targetType === 'stack' || targetType === 'collection') ? 'collections' : 'cards';
  
  // Get current stats
  const { data: target } = await serviceClient
    .from(table)
    .select('stats')
    .eq('id', targetId)
    .single();

  if (target) {
    const stats = target.stats || {};
    const currentComments = (stats.comments || 0) + delta;
    
    await serviceClient
      .from(table)
      .update({
        stats: {
          ...stats,
          comments: Math.max(0, currentComments),
        },
      })
      .eq('id', targetId);
  }
}

