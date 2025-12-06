import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { createServiceClient } from '@/lib/supabase/api-service';

// GET collection
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient(request);
    const { data: { user } } = await supabase.auth.getUser();

    // Try to get collection by ID first
    let { data: collection, error: collectionError } = await supabase
      .from('collections')
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
        owner:users!collections_owner_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('id', id)
      .maybeSingle();

    // If not found by ID, try by slug
    if (!collection && !collectionError) {
      const { data: collectionBySlug, error: slugError } = await supabase
        .from('collections')
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
          owner:users!collections_owner_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('slug', id)
        .maybeSingle();
      
      collection = collectionBySlug;
      collectionError = slugError;
    }

    if (collectionError) {
      console.error('Error fetching collection:', collectionError);
      return NextResponse.json(
        { error: collectionError.message || 'Failed to fetch collection' },
        { status: 400 }
      );
    }

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Check if user can view this collection
    // Public collections are visible to everyone
    // Private collections are only visible to owner
    if (!collection.is_public && (!user || collection.owner_id !== user.id)) {
      return NextResponse.json(
        { error: 'Collection not found' }, // Don't reveal existence of private collections
        { status: 404 }
      );
    }

    // Hidden collections are only visible to owner
    if (collection.is_hidden && (!user || collection.owner_id !== user.id)) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ collection });
  } catch (error: any) {
    console.error('Unexpected error fetching collection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE collection
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

    // Check if collection exists and user is owner
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('id, owner_id')
      .eq('id', id)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    if (collection.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own collections' },
        { status: 403 }
      );
    }

    // Get all cards in this collection before deleting
    const { data: collectionCards } = await supabase
      .from('collection_cards')
      .select('card_id')
      .eq('collection_id', id);

    // Use service client to delete cards that are only in this collection
    const serviceClient = createServiceClient();

    if (collectionCards && collectionCards.length > 0) {
      const cardIds = collectionCards.map(cc => cc.card_id);

      // For each card, check if it's only in this collection
      for (const cardId of cardIds) {
        // Check if card is in other collections
        const { data: otherCollections } = await serviceClient
          .from('collection_cards')
          .select('id')
          .eq('card_id', cardId)
          .neq('collection_id', id)
          .limit(1);

        // Also check legacy stacks
        const { data: legacyStacks } = await serviceClient
          .from('stack_cards')
          .select('id')
          .eq('card_id', cardId)
          .limit(1);

        // If card is not in any other collection or stack, delete it
        if ((!otherCollections || otherCollections.length === 0) &&
            (!legacyStacks || legacyStacks.length === 0)) {
          await serviceClient
            .from('cards')
            .delete()
            .eq('id', cardId);
        }
      }
    }

    // Delete collection (cascade will handle collection_cards relationships)
    const { error: deleteError } = await supabase
      .from('collections')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (deleteError) {
      console.error('Error deleting collection:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete collection' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error deleting collection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH collection (update)
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

    // Check if collection exists and user is owner
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('id, owner_id, is_public')
      .eq('id', id)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    if (collection.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only edit your own collections' },
        { status: 403 }
      );
    }

    // Check if user is trying to publish (change from private to public) and is not a stacker
    const isTryingToPublish = body.is_public === true && collection.is_public === false;
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

    // Update collection
    const { data: updatedCollection, error: updateError } = await supabase
      .from('collections')
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
      console.error('Error updating collection:', updateError);
      return NextResponse.json(
        { error: 'Failed to update collection' },
        { status: 500 }
      );
    }

    // Note: Card visibility is automatically synced via database trigger
    // (see migration 036_sync_card_visibility_with_collection.sql)
    // The trigger handles updating cards' is_public when collection visibility changes

    return NextResponse.json({ collection: updatedCollection });
  } catch (error) {
    console.error('Unexpected error updating collection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

