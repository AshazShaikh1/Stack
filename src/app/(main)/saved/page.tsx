import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { FeedGrid } from '@/components/feed/FeedGrid';
import { CollectionGridSkeleton } from '@/components/ui/Skeleton';
import { EmptySavedCollectionsState } from '@/components/ui/EmptyState';
import { Suspense } from 'react';
import { SavedCollectionsClient } from './SavedCollectionsClient';
import Link from 'next/link';

interface SavedPageProps {
  searchParams: Promise<{
    filter?: string;
  }>;
}

async function SavedCollections({ filter = 'all' }: { filter?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  // Query saves table directly
  // Handle both target_type/target_id (new) and collection_id/stack_id (legacy) columns
  // Wrap in try-catch to handle potential foreign key constraint issues
  let saves: any[] = [];
  
  try {
    const result = await supabase
      .from('saves')
      .select('target_type, target_id, collection_id, card_id, stack_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    // If there's an error OR data is null, return empty state
    if (result.error || result.data === null) {
      return <EmptySavedCollectionsState />;
    }
    
    saves = result.data || [];
  } catch (err) {
    // Catch any unexpected errors (like broken foreign key constraints)
    // Silently return empty state - migration may need to be applied
    return <EmptySavedCollectionsState />;
  }
  
  if (saves.length === 0) {
    return <EmptySavedCollectionsState />;
  }

  // Separate collections and cards
  const collectionIds = saves
    .filter(s => {
      const type = s.target_type || (s.collection_id || s.stack_id ? 'collection' : null);
      return type === 'collection' || (!s.target_type && (s.collection_id || s.stack_id));
    })
    .map(s => s.target_id || s.collection_id || s.stack_id)
    .filter((id): id is string => !!id);

  const cardIds = saves
    .filter(s => {
      const type = s.target_type || (s.card_id ? 'card' : null);
      return type === 'card';
    })
    .map(s => s.target_id || s.card_id)
    .filter((id): id is string => !!id);

  // Fetch collections
  let collections: any[] = [];
  if (collectionIds.length > 0) {
    const { data: collectionsData, error: collectionsError } = await supabase
      .from('collections')
      .select(`
        id,
        title,
        description,
        slug,
        cover_image_url,
        is_public,
        stats,
        owner_id,
        created_at,
        owner:users!collections_owner_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .in('id', collectionIds)
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (!collectionsError && collectionsData) {
      collections = collectionsData;
    }
  }

  // Fetch cards
  let cards: any[] = [];
  if (cardIds.length > 0) {
    const { data: cardsData, error: cardsError } = await supabase
      .from('cards')
      .select(`
        id,
        title,
        description,
        thumbnail_url,
        canonical_url,
        domain,
        metadata
      `)
      .in('id', cardIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (!cardsError && cardsData) {
      cards = cardsData;
    }
  }

  // Combine collections and cards for display, filtered by selected tab
  let allItems: any[] = [];
  
  if (filter === 'collection') {
    allItems = collections.map(c => ({ type: 'collection' as const, ...c }));
  } else if (filter === 'card') {
    allItems = cards.map(c => ({ type: 'card' as const, ...c }));
  } else {
    // 'all' - show both
    allItems = [
      ...collections.map(c => ({ type: 'collection' as const, ...c })),
      ...cards.map(c => ({ type: 'card' as const, ...c })),
    ];
  }

  if (allItems.length === 0) {
    return <EmptySavedCollectionsState />;
  }

  return <FeedGrid items={allItems} />;
}

export default async function SavedPage({ searchParams }: SavedPageProps) {
  const { filter = 'all' } = await searchParams;
  const activeFilter = filter === 'collection' || filter === 'card' ? filter : 'all';

  return (
    <div className="container mx-auto px-page py-section">
      <div className="mb-8">
        <h1 className="text-h1 font-bold text-jet-dark mb-2">Saved Items</h1>
        <p className="text-body text-gray-muted mb-6">
          All the collections and cards you&apos;ve saved for later
        </p>

        {/* Filter Tabs */}
        <div className="border-b border-gray-light">
          <div className="flex gap-8">
            <Link
              href="/saved?filter=all"
              className={`
                pb-4 px-1 border-b-2 transition-colors
                ${activeFilter === 'all'
                  ? 'border-jet text-jet-dark font-semibold'
                  : 'border-transparent text-gray-muted hover:text-jet-dark'
                }
              `}
            >
              All
            </Link>
            <Link
              href="/saved?filter=collection"
              className={`
                pb-4 px-1 border-b-2 transition-colors
                ${activeFilter === 'collection'
                  ? 'border-jet text-jet-dark font-semibold'
                  : 'border-transparent text-gray-muted hover:text-jet-dark'
                }
              `}
            >
              Collection
            </Link>
            <Link
              href="/saved?filter=card"
              className={`
                pb-4 px-1 border-b-2 transition-colors
                ${activeFilter === 'card'
                  ? 'border-jet text-jet-dark font-semibold'
                  : 'border-transparent text-gray-muted hover:text-jet-dark'
                }
              `}
            >
              Card
            </Link>
          </div>
        </div>
      </div>

      <SavedCollectionsClient />
      <Suspense fallback={<CollectionGridSkeleton />}>
        <SavedCollections filter={activeFilter} />
      </Suspense>
    </div>
  );
}

