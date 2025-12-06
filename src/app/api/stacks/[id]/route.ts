import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { createServiceClient } from '@/lib/supabase/api-service';

// GET stack
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient(request);
    const { data: { user } } = await supabase.auth.getUser();

    // Try to get stack by ID first
    let { data: stack, error: stackError } = await supabase
      .from('stacks')
      .select(`
        id,
        title,
        description,
        slug,
        cover_image_url,
        is_public,
        is_hidden,
        owner_id,
        stats,
        created_at,
        updated_at,
        owner:users!stacks_owner_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('id', id)
      .maybeSingle();

    // If not found by ID, try by slug
    if (!stack && !stackError) {
      const { data: stackBySlug, error: slugError } = await supabase
        .from('stacks')
        .select(`
          id,
          title,
          description,
          slug,
          cover_image_url,
          is_public,
          is_hidden,
          owner_id,
          stats,
          created_at,
          updated_at,
          owner:users!stacks_owner_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('slug', id)
        .maybeSingle();
      
      stack = stackBySlug;
      stackError = slugError;
    }

    if (stackError) {
      console.error('Error fetching stack:', stackError);
      return NextResponse.json(
        { error: stackError.message || 'Failed to fetch stack' },
        { status: 400 }
      );
    }

    if (!stack) {
      return NextResponse.json(
        { error: 'Stack not found' },
        { status: 404 }
      );
    }

    // Check if user can view this stack
    // Public stacks are visible to everyone
    // Private stacks are only visible to owner
    if (!stack.is_public && (!user || stack.owner_id !== user.id)) {
      return NextResponse.json(
        { error: 'Stack not found' }, // Don't reveal existence of private stacks
        { status: 404 }
      );
    }

    // Hidden stacks are only visible to owner
    if (stack.is_hidden && (!user || stack.owner_id !== user.id)) {
      return NextResponse.json(
        { error: 'Stack not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ stack });
  } catch (error: any) {
    console.error('Unexpected error fetching stack:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE stack
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient(request);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if stack exists and user is owner
    const { data: stack, error: stackError } = await supabase
      .from('stacks')
      .select('id, owner_id')
      .eq('id', id)
      .single();

    if (stackError || !stack) {
      return NextResponse.json(
        { error: 'Stack not found' },
        { status: 404 }
      );
    }

    if (stack.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own stacks' },
        { status: 403 }
      );
    }

    // Get all cards in this stack before deleting
    const { data: stackCards } = await supabase
      .from('stack_cards')
      .select('card_id')
      .eq('stack_id', id);

    // Use service client to delete cards that are only in this stack
    const serviceClient = createServiceClient();

    if (stackCards && stackCards.length > 0) {
      const cardIds = stackCards.map(sc => sc.card_id);

      // For each card, check if it's only in this stack
      for (const cardId of cardIds) {
        // Check if card is in other stacks
        const { data: otherStacks } = await serviceClient
          .from('stack_cards')
          .select('id')
          .eq('card_id', cardId)
          .neq('stack_id', id)
          .limit(1);

        // Also check collections
        const { data: collections } = await serviceClient
          .from('collection_cards')
          .select('id')
          .eq('card_id', cardId)
          .limit(1);

        // If card is not in any other stack or collection, delete it
        if ((!otherStacks || otherStacks.length === 0) &&
            (!collections || collections.length === 0)) {
          await serviceClient
            .from('cards')
            .delete()
            .eq('id', cardId);
        }
      }
    }

    // Delete stack (cascade will handle stack_cards relationships)
    const { error: deleteError } = await supabase
      .from('stacks')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (deleteError) {
      console.error('Error deleting stack:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete stack' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error deleting stack:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH stack (update)
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

    // Check if stack exists and user is owner
    const { data: stack, error: stackError } = await supabase
      .from('stacks')
      .select('id, owner_id, is_public')
      .eq('id', id)
      .single();

    if (stackError || !stack) {
      return NextResponse.json(
        { error: 'Stack not found' },
        { status: 404 }
      );
    }

    if (stack.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only edit your own stacks' },
        { status: 403 }
      );
    }

    // Check if user is trying to publish (change from private to public) and is not a stacker
    const isTryingToPublish = body.is_public === true && stack.is_public === false;
    if (isTryingToPublish || body.is_public === true) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userProfile?.role !== 'stacker' && userProfile?.role !== 'admin') {
        return NextResponse.json(
          { 
            error: 'Only Stacqers can publish public collections',
            become_stacker_required: true,
            required_fields: ['display_name', 'avatar_url', 'short_bio']
          },
          { status: 403 }
        );
      }
    }

    // Update stack
    const { data: updatedStack, error: updateError } = await supabase
      .from('stacks')
      .update({
        title: body.title,
        description: body.description,
        slug: body.slug,
        is_public: body.is_public,
        is_hidden: body.is_hidden,
        cover_image_url: body.cover_image_url,
      })
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating stack:', updateError);
      return NextResponse.json(
        { error: 'Failed to update stack' },
        { status: 500 }
      );
    }

    return NextResponse.json({ stack: updatedStack });
  } catch (error) {
    console.error('Unexpected error updating stack:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

