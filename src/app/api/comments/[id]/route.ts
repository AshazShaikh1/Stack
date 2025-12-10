import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { createServiceClient } from '@/lib/supabase/api-service';

// PATCH comment (update)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient(request);
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if comment exists
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id, user_id, content, deleted')
      .eq('id', id)
      .single();

    if (commentError || !comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    if (comment.deleted) {
      return NextResponse.json(
        { error: 'Cannot edit deleted comment' },
        { status: 400 }
      );
    }

    // Check if user is the comment author
    if (comment.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only edit your own comments' },
        { status: 403 }
      );
    }

    // Update comment
    const serviceClient = createServiceClient();
    const { data: updatedComment, error: updateError } = await serviceClient
      .from('comments')
      .update({
        content: body.content.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
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

    if (updateError) {
      console.error('Error updating comment:', updateError);
      return NextResponse.json(
        { error: 'Failed to update comment' },
        { status: 500 }
      );
    }

    return NextResponse.json({ comment: updatedComment });
  } catch (error) {
    console.error('Unexpected error updating comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE comment (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const collectionId = searchParams.get('collection_id');
    const stackId = searchParams.get('stack_id'); // Legacy support
    
    const supabase = await createClient(request);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if comment exists
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id, user_id, target_type, target_id')
      .eq('id', id)
      .single();

    if (commentError || !comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Check if user is comment author
    const isAuthor = comment.user_id === user.id;

    // Check if user is collection/stack owner (support both collection and stack types)
    let isOwner = false;
    const targetId = collectionId || stackId || comment.target_id;
    const targetType = comment.target_type === 'stack' ? 'collection' : comment.target_type;
    
    if ((targetType === 'collection' || comment.target_type === 'stack') && targetId) {
      // Try collections first
      const { data: collection } = await supabase
        .from('collections')
        .select('owner_id')
        .eq('id', targetId)
        .single();
      
      if (collection) {
        isOwner = collection.owner_id === user.id;
      } else {
        // Fallback to stacks for legacy support
        const { data: stack } = await supabase
          .from('stacks')
          .select('owner_id')
          .eq('id', targetId)
          .single();
        
        isOwner = stack?.owner_id === user.id;
      }
    }

    if (!isAuthor && !isOwner) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own comments or comments on your collections' },
        { status: 403 }
      );
    }

    // Soft delete the comment using service client to bypass RLS
    const serviceClient = createServiceClient();
    
    // First verify the comment exists and get its current state
    const { data: existingComment } = await serviceClient
      .from('comments')
      .select('id, deleted')
      .eq('id', id)
      .single();

    if (!existingComment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    if (existingComment.deleted) {
      return NextResponse.json(
        { error: 'Comment already deleted' },
        { status: 400 }
      );
    }

    // Perform the soft delete
    const { data: deletedComment, error: deleteError } = await serviceClient
      .from('comments')
      .update({ deleted: true })
      .eq('id', id)
      .select('id, deleted')
      .single();

    if (deleteError) {
      console.error('Error deleting comment:', deleteError);
      console.error('Delete error details:', {
        message: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint,
        code: deleteError.code,
        commentId: id,
        userId: user.id,
        isAuthor,
        isStackOwner: isOwner,
      });
      return NextResponse.json(
        { error: deleteError.message || 'Failed to delete comment. Check RLS policies.' },
        { status: 500 }
      );
    }

    if (!deletedComment || !deletedComment.deleted) {
      console.error('Comment deletion failed - comment still not marked as deleted:', { commentId: id });
      return NextResponse.json(
        { error: 'Failed to delete comment' },
        { status: 500 }
      );
    }

    console.log('Comment soft-deleted successfully:', { commentId: id, deleted: deletedComment.deleted });

    // Update comment stats
    await updateCommentStats(serviceClient, comment.target_type, comment.target_id, -1);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error deleting comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to update comment stats
async function updateCommentStats(
  serviceClient: any,
  targetType: string,
  targetId: string,
  delta: number
) {
  try {
    // Support both collection and stack (legacy)
    const normalizedType = targetType === 'stack' ? 'collection' : targetType;
    
    if (normalizedType === 'collection') {
      // Try collections first
      const { data: collection } = await serviceClient
        .from('collections')
        .select('stats')
        .eq('id', targetId)
        .single();

      if (collection) {
        const stats = collection.stats || {};
        const currentComments = stats.comments || 0;
        const newComments = Math.max(0, currentComments + delta);

        await serviceClient
          .from('collections')
          .update({
            stats: {
              ...stats,
              comments: newComments,
            },
          })
          .eq('id', targetId);
        return;
      }
      
      // Fallback to stacks for legacy support
      const { data: stack } = await serviceClient
        .from('stacks')
        .select('stats')
        .eq('id', targetId)
        .single();

      if (stack) {
        const stats = stack.stats || {};
        const currentComments = stats.comments || 0;
        const newComments = Math.max(0, currentComments + delta);

        await serviceClient
          .from('stacks')
          .update({
            stats: {
              ...stats,
              comments: newComments,
            },
          })
          .eq('id', targetId);
      }
    }
  } catch (error) {
    console.error('Error updating comment stats:', error);
  }
}

