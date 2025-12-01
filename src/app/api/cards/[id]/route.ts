import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';

// GET card by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient(request);

    // Fetch card
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select(`
        id,
        canonical_url,
        title,
        description,
        thumbnail_url,
        domain,
        created_by,
        created_at,
        last_checked_at,
        status,
        metadata,
        creator:users!cards_created_by_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (cardError) {
      console.error('Error fetching card:', cardError);
      return NextResponse.json(
        { error: cardError.message || 'Failed to fetch card' },
        { status: 400 }
      );
    }

    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ card });
  } catch (error: any) {
    console.error('Unexpected error fetching card:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE card from database
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const stackId = searchParams.get('stack_id');
    
    const supabase = await createClient(request);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!stackId) {
      return NextResponse.json(
        { error: 'stack_id is required' },
        { status: 400 }
      );
    }

    // Check if stack exists and user is owner
    const { data: stack, error: stackError } = await supabase
      .from('stacks')
      .select('id, owner_id')
      .eq('id', stackId)
      .single();

    if (stackError || !stack) {
      return NextResponse.json(
        { error: 'Stack not found' },
        { status: 404 }
      );
    }

    // Check if card exists
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, created_by')
      .eq('id', id)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    // Check if user is stack owner or the one who added the card
    const { data: stackCard } = await supabase
      .from('stack_cards')
      .select('added_by')
      .eq('stack_id', stackId)
      .eq('card_id', id)
      .maybeSingle();

    const canDelete = stack.owner_id === user.id || 
                      (stackCard && stackCard.added_by === user.id) ||
                      (card.created_by === user.id);

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete cards from your own stacks, cards you added, or cards you created' },
        { status: 403 }
      );
    }

    // Delete the card from the database (cascade will handle stack_cards relationships)
    const { error: deleteError, data: deleteData } = await supabase
      .from('cards')
      .delete()
      .eq('id', id)
      .select();

    if (deleteError) {
      console.error('Error deleting card:', deleteError);
      console.error('Delete error details:', {
        message: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint,
        code: deleteError.code,
      });
      return NextResponse.json(
        { error: deleteError.message || 'Failed to delete card. Check RLS policies.' },
        { status: 500 }
      );
    }

    console.log('Card deleted successfully:', { cardId: id, deletedRows: deleteData });

    return NextResponse.json({ success: true, deleted: deleteData });
  } catch (error) {
    console.error('Unexpected error deleting card:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH card (update card metadata)
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

    // Check if card exists
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, created_by')
      .eq('id', id)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    // Check if user created the card or can edit it (for now, allow if user created it)
    // In the future, we might want to check if user added it to any of their stacks
    if (card.created_by && card.created_by !== user.id) {
      // Check if user has this card in any of their stacks
      const { data: userStacks } = await supabase
        .from('stacks')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1);

      if (!userStacks || userStacks.length === 0) {
        return NextResponse.json(
          { error: 'Forbidden: You can only edit cards you created or cards in your stacks' },
          { status: 403 }
        );
      }

      // Check if this card is in any of user's stacks
      const { data: stackCard } = await supabase
        .from('stack_cards')
        .select('stack_id')
        .eq('card_id', id)
        .in('stack_id', userStacks.map(s => s.id))
        .limit(1);

      if (!stackCard || stackCard.length === 0) {
        return NextResponse.json(
          { error: 'Forbidden: You can only edit cards in your stacks' },
          { status: 403 }
        );
      }
    }

    // Update card
    const { data: updatedCard, error: updateError } = await supabase
      .from('cards')
      .update({
        title: body.title,
        description: body.description,
        thumbnail_url: body.thumbnail_url,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating card:', updateError);
      return NextResponse.json(
        { error: 'Failed to update card' },
        { status: 500 }
      );
    }

    return NextResponse.json({ card: updatedCard });
  } catch (error) {
    console.error('Unexpected error updating card:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

