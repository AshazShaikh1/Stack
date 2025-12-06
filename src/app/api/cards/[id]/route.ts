import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { createServiceClient } from '@/lib/supabase/api-service';

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

// DELETE card from collection/stack or remove from collection/stack
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

    // If collection_id or stack_id is provided, remove card from collection/stack
    // Otherwise, delete the card entirely (only if user created it)
    if (collectionId || stackId) {
      const targetId = collectionId || stackId;
      const isCollection = !!collectionId;
      const tableName = isCollection ? 'collection_cards' : 'stack_cards';
      const idField = isCollection ? 'collection_id' : 'stack_id';
      const collectionTable = isCollection ? 'collections' : 'stacks';

      // Check if collection/stack exists and user is owner
      const { data: collection, error: collectionError } = await supabase
        .from(collectionTable)
        .select('id, owner_id')
        .eq('id', targetId)
        .single();

      if (collectionError || !collection) {
        return NextResponse.json(
          { error: `${isCollection ? 'Collection' : 'Stack'} not found` },
          { status: 404 }
        );
      }

      // Check if user is collection/stack owner or the one who added the card
      const { data: mapping } = await supabase
        .from(tableName)
        .select('added_by')
        .eq(idField, targetId)
        .eq('card_id', id)
        .maybeSingle();

      const isOwner = collection.owner_id === user.id;
      const canDelete = isOwner || 
                        (mapping && mapping.added_by === user.id) ||
                        (card.created_by === user.id);

      if (!canDelete) {
        return NextResponse.json(
          { error: `Forbidden: You can only remove cards from your own ${isCollection ? 'collections' : 'stacks'}, cards you added, or cards you created` },
          { status: 403 }
        );
      }

      // If user is the collection/stack owner, delete the card from DB
      // Otherwise, just remove it from the collection/stack
      if (isOwner) {
        // Check if card is in other collections/stacks
        const { data: otherMappings } = await supabase
          .from(isCollection ? 'collection_cards' : 'stack_cards')
          .select('id')
          .eq('card_id', id)
          .neq(idField, targetId)
          .limit(1);

        // If card is only in this collection/stack, delete it from DB
        // Otherwise, just remove it from this collection/stack
        if (!otherMappings || otherMappings.length === 0) {
          // Also check legacy table if needed
          const legacyTable = isCollection ? 'stack_cards' : 'collection_cards';
          const legacyField = isCollection ? 'stack_id' : 'collection_id';
          
          const { data: legacyMappings } = await supabase
            .from(legacyTable)
            .select('id')
            .eq('card_id', id)
            .limit(1);

          if (!legacyMappings || legacyMappings.length === 0) {
            // Card is not in any other collection/stack - delete from DB
            // Use service client to bypass RLS for deletion
            const serviceClient = createServiceClient();
            const { error: deleteError } = await serviceClient
              .from('cards')
              .delete()
              .eq('id', id);

            if (deleteError) {
              console.error('Error deleting card:', deleteError);
              return NextResponse.json(
                { error: 'Failed to delete card' },
                { status: 500 }
              );
            }

            return NextResponse.json({ 
              success: true, 
              message: 'Card deleted successfully' 
            });
          }
        }

        // Card is in other collections/stacks - just remove from this one
        const { error: removeError } = await supabase
          .from(tableName)
          .delete()
          .eq(idField, targetId)
          .eq('card_id', id);

        if (removeError) {
          console.error('Error removing card from collection/stack:', removeError);
          return NextResponse.json(
            { error: 'Failed to remove card from collection/stack' },
            { status: 500 }
          );
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Card removed from collection/stack successfully' 
        });
      } else {
        // Non-owner - just remove from collection/stack
        const { error: removeError } = await supabase
          .from(tableName)
          .delete()
          .eq(idField, targetId)
          .eq('card_id', id);

        if (removeError) {
          console.error('Error removing card from collection/stack:', removeError);
          return NextResponse.json(
            { error: 'Failed to remove card from collection/stack' },
            { status: 500 }
          );
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Card removed from collection/stack successfully' 
        });
      }
    } else {
      // No collection/stack ID provided - delete the card entirely
      // Only allow if user created the card
      if (card.created_by !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden: You can only delete cards you created. To remove a card from a collection, provide collection_id or stack_id.' },
          { status: 403 }
        );
      }

      // Delete the card from the database (cascade will handle relationships)
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
    }
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
          { error: 'Forbidden: You can only edit cards you created or cards in your collections' },
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
          { error: 'Forbidden: You can only edit cards in your collections' },
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

