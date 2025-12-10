import { createClient } from '@/lib/supabase/server';
import { CollectionHeader } from '@/components/collection/CollectionHeader';
import { CardPreview } from '@/components/card/CardPreview';
import { AddCardButton } from '@/components/card/AddCardButton';
import { EmptyCardsWithAdd } from '@/components/card/EmptyCardsWithAdd';
import { generateMetadata as generateSEOMetadata } from '@/lib/seo';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Suspense, lazy } from 'react';
import { CommentSkeleton } from '@/components/ui/Skeleton';
import { cached } from '@/lib/redis';
import { getCacheKey, CACHE_TTL } from '@/lib/cache/supabase-cache';
import { EmptyCardsState } from '@/components/ui/EmptyState';

// Enable ISR with 60 second revalidation
export const revalidate = 60;

// Lazy load comments section - it's heavy and not always needed immediately
const CommentsSection = lazy(() => import('@/components/comments/CommentsSection').then(m => ({ default: m.CommentsSection })));

interface CollectionPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  
  // Try to fetch collection for metadata
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  
  let collection: any = null;
  if (isUUID) {
    const { data } = await supabase
      .from('collections')
      .select('title, description, cover_image_url, is_public, is_hidden')
      .eq('id', id)
      .maybeSingle();
    collection = data;
  } else {
    const { data } = await supabase
      .from('collections')
      .select('title, description, cover_image_url, is_public, is_hidden')
      .eq('slug', id)
      .maybeSingle();
    collection = data;
  }
  
  if (!collection || (!collection.is_public && collection.is_hidden)) {
    return generateSEOMetadata({
      title: 'Collection Not Found',
      description: 'The collection you are looking for does not exist or is private',
    });
  }
  
  return generateSEOMetadata({
    title: collection.title,
    description: collection.description || `View ${collection.title} on Stacq`,
    image: collection.cover_image_url || undefined,
    url: `/collection/${id}`,
    type: 'article',
  });
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  try {
    const { id } = await params;
    
    if (!id || id.trim() === '') {
      console.error('Invalid collection ID provided:', id);
      notFound();
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Helper function to check if string is a valid UUID
    const isUUID = (str: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    // Generate cache key for collection data
    const cacheKey = getCacheKey('collection', { id, userId: user?.id || 'anonymous' });
    
    // Fetch collection data with Redis caching (120s TTL)
    // Use batch RPC function for optimal performance
    const collectionData = await cached(
      cacheKey,
      async () => {
        // Try using batch RPC function first (more efficient)
        const { data: batchData, error: rpcError } = await supabase.rpc(
          'get_collection_with_cards',
          {
            collection_identifier: id,
            requesting_user_id: user?.id || null,
          }
        );

        if (!rpcError && batchData) {
          // Transform RPC response to match expected format
          const collection = batchData.collection;
          const owner = batchData.owner;
          const tags = batchData.tags || [];
          const cards = (batchData.cards || []).map((card: any) => ({
            ...card,
            addedBy: card.added_by,
          }));

          return {
            collection: {
              ...collection,
              owner,
              tags: tags.map((t: any) => ({ tag: t })),
            },
            cards,
          };
        }

        // Fallback to individual queries if RPC function doesn't exist or fails
        console.warn('Batch RPC function not available, using fallback queries:', rpcError?.message);
        
        // Get collection with owner and tags
        // Try by UUID first if it looks like a UUID, otherwise try by slug
        let collection: any = null;
        let collectionError: any = null;
        
        if (isUUID(id)) {
          // Try by UUID first
          const result = await supabase
            .from('collections')
            .select(`
              id,
              title,
              description,
              cover_image_url,
              owner_id,
              stats,
              is_public,
              is_hidden,
              slug,
              owner:users!collections_owner_id_fkey (
                username,
                display_name,
                avatar_url
              ),
              tags:collection_tags (
                tag:tags (
                  id,
                  name
                )
              )
            `)
            .eq('id', id)
            .maybeSingle();
          
          collection = result.data;
          collectionError = result.error;
        }

        // If not found by UUID (or not a UUID), try by slug
        if (!collection && !collectionError) {
          const result = await supabase
            .from('collections')
            .select(`
              id,
              title,
              description,
              cover_image_url,
              owner_id,
              stats,
              is_public,
              is_hidden,
              slug,
              owner:users!collections_owner_id_fkey (
                username,
                display_name,
                avatar_url
              ),
              tags:collection_tags (
                tag:tags (
                  id,
                  name
                )
              )
            `)
            .eq('slug', id)
            .maybeSingle();
          
          collection = result.data;
          collectionError = result.error;
        }

        if (collectionError) {
          throw collectionError;
        }

        if (!collection) {
          return null;
        }

        // Get cards in this collection with ownership info (batch fetch)
        const { data: collectionCards, error: cardsError } = await supabase
          .from('collection_cards')
          .select(`
            card:cards (
              id,
              title,
              description,
              thumbnail_url,
              canonical_url,
              domain
            ),
            added_by
          `)
          .eq('collection_id', collection.id)
          .order('added_at', { ascending: false });

        if (cardsError) {
          console.error('Error fetching cards:', cardsError);
        }

        const cards = collectionCards?.map((cc: any) => ({
          ...cc.card,
          addedBy: cc.added_by,
        })).filter((c: any) => c.id) || [];

        return {
          collection,
          cards,
        };
      },
      CACHE_TTL.COLLECTIONS
    );

    if (!collectionData || !collectionData.collection) {
      console.error('Collection not found for id/slug:', id);
      notFound();
    }

    const { collection, cards } = collectionData;

    // Check if user can view this collection (check after cache to avoid caching private data)
    const canView = collection.is_public || 
                    collection.owner_id === user?.id || 
                    (collection.is_hidden && collection.owner_id === user?.id);

    if (!canView) {
      console.error('Access denied to collection:', {
        collection_id: collection.id,
        is_public: collection.is_public,
        is_hidden: collection.is_hidden,
        owner_id: collection.owner_id,
        user_id: user?.id,
      });
      notFound();
    }

    const isOwner = collection.owner_id === user?.id;

    // Transform tags
    const transformedTags = collection.tags?.map((ct: any) => ct.tag).filter(Boolean) || [];

    // Ensure owner is a single object, not an array
    const owner = Array.isArray(collection.owner) ? collection.owner[0] : collection.owner;

  return (
    <div className="container mx-auto px-page py-section">
      <CollectionHeader 
        collection={{
          ...collection,
          owner: owner,
          tags: transformedTags,
          is_public: collection.is_public,
          is_hidden: collection.is_hidden,
        }}
        isOwner={isOwner}
      />

      {/* Add Card Button - Show for owners when cards exist */}
      {isOwner && cards.length > 0 && (
        <div className="mb-6 flex justify-end">
          <AddCardButton collectionId={collection.id} />
        </div>
      )}

      {/* Cards Grid */}
      {cards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.map((card: any) => (
            <CardPreview 
              key={card.id} 
              card={card} 
              collectionId={collection.id}
              collectionOwnerId={collection.owner_id}
              addedBy={card.addedBy}
            />
          ))}
        </div>
      ) : (
        <div>
          {isOwner ? (
            <EmptyCardsWithAdd collectionId={collection.id} />
          ) : (
            <EmptyCardsState />
          )}
        </div>
      )}

      {/* Comments Section */}
      <Suspense fallback={
        <div className="py-8">
          <h2 className="text-h2 font-bold text-jet-dark mb-6">Comments</h2>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <CommentSkeleton key={i} />
            ))}
          </div>
        </div>
      }>
        <CommentsSection targetType="collection" targetId={collection.id} collectionOwnerId={collection.owner_id} />
      </Suspense>
    </div>
  );
  } catch (error) {
    console.error('Unexpected error in CollectionPage:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    notFound();
  }
}

