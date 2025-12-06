import { createClient } from '@/lib/supabase/server';
import { CollectionCard } from '@/components/collection/CollectionCard';
import { CardPreview } from '@/components/card/CardPreview';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { StackGridSkeleton } from '@/components/ui/Skeleton';
import { EmptySearchState, EmptyState } from '@/components/ui/EmptyState';
import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
  }>;
}

async function SearchResults({ query, type }: { query: string; type: string }) {
  if (!query || query.trim().length === 0) {
    return (
      <EmptyState
        icon="🔍"
        title="Start searching"
        description="Search for collections, cards, and creators"
      />
    );
  }

  const supabase = await createClient();
  const searchQuery = query.trim();

  // Build search results
  const results: {
    collections: any[];
    cards: any[];
    users: any[];
  } = {
    collections: [],
    cards: [],
    users: [],
  };

  // Search Collections (support legacy 'stacks' type)
  if (type === 'all' || type === 'stacks' || type === 'collections') {
    // Use full-text search with search_vector
    const searchTerms = searchQuery.split(' ').filter(t => t.length > 0).join(' & ');
    const { data: collections } = await supabase
      .from('collections')
      .select(`
        id,
        title,
        description,
        cover_image_url,
        owner_id,
        stats,
        slug,
        owner:users!collections_owner_id_fkey (
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('is_public', true)
      .eq('is_hidden', false)
      .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (collections) {
      // Filter by full-text search if search_vector is available
      const filtered = collections.filter((collection: any) => {
        const titleMatch = collection.title?.toLowerCase().includes(searchQuery.toLowerCase());
        const descMatch = collection.description?.toLowerCase().includes(searchQuery.toLowerCase());
        return titleMatch || descMatch;
      });
      results.collections = filtered;
    }
  }

  // Search Cards
  if (type === 'all' || type === 'cards') {
    const { data: cards } = await supabase
      .from('cards')
      .select(`
        id,
        title,
        description,
        thumbnail_url,
        canonical_url,
        domain
      `)
      .eq('status', 'active')
      .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (cards) {
      results.cards = cards;
    }
  }

  // Search Users
  if (type === 'all' || type === 'users') {
    const { data: users } = await supabase
      .from('users')
      .select(`
        id,
        username,
        display_name,
        avatar_url
      `)
      .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
      .limit(20);

    if (users) {
      results.users = users;
    }
  }

  const totalResults = results.collections.length + results.cards.length + results.users.length;

  if (totalResults === 0) {
    return <EmptySearchState query={query} />;
  }

  return (
    <div className="space-y-8">
      {/* Results Summary */}
      <div className="text-body text-gray-muted">
        Found {totalResults} result{totalResults !== 1 ? 's' : ''} for &quot;{query}&quot;
      </div>

      {/* Collections Results */}
      {results.collections.length > 0 && (
        <div>
          <h2 className="text-h2 font-bold text-jet-dark mb-4">
            Collections ({results.collections.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {results.collections.map((collection: any) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        </div>
      )}

      {/* Cards Results */}
      {results.cards.length > 0 && (
        <div>
          <h2 className="text-h2 font-bold text-jet-dark mb-4">
            Cards ({results.cards.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {results.cards.map((card: any) => (
              <CardPreview key={card.id} card={card} />
            ))}
          </div>
        </div>
      )}

      {/* Users Results */}
      {results.users.length > 0 && (
        <div>
          <h2 className="text-h2 font-bold text-jet-dark mb-4">
            Creators ({results.users.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {results.users.map((user: any) => (
              <Link
                key={user.id}
                href={`/profile/${user.username}`}
                className="block"
              >
                <div className="p-4 bg-white rounded-lg border border-gray-light hover:border-jet transition-colors">
                  <div className="flex items-center gap-3">
                    {user.avatar_url ? (
                      <Image
                        src={user.avatar_url}
                        alt={user.display_name}
                        width={48}
                        height={48}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-jet/20 flex items-center justify-center text-lg font-semibold text-jet">
                        {user.display_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-body font-semibold text-jet-dark truncate">
                        {user.display_name}
                      </div>
                      <div className="text-small text-gray-muted truncate">
                        @{user.username}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams.q || '';
  const type = resolvedSearchParams.type || 'all';

  return (
    <div className="container mx-auto px-page py-section">
      {/* Search Header */}
      <div className="mb-8">
        <h1 className="text-h1 font-bold text-jet-dark mb-6">Search</h1>
        
        {/* Search Form */}
        <form action="/search" method="get" className="mb-6">
          <div className="flex gap-3">
            <Input
              type="text"
              name="q"
              placeholder="Search collections, cards, and stacqers..."
              defaultValue={query}
              className="flex-1"
            />
            <input type="hidden" name="type" value={type} />
            <Button type="submit" variant="primary">
              Search
            </Button>
          </div>
        </form>

        {/* Type Filters */}
        <div className="flex gap-2">
          <Link
            href={`/search?q=${encodeURIComponent(query)}&type=all`}
            className={`px-4 py-2 rounded-md text-small font-medium transition-colors ${
              type === 'all'
                ? 'bg-jet text-white'
                : 'bg-gray-light text-jet-dark hover:bg-jet/10'
            }`}
          >
            All
          </Link>
          <Link
            href={`/search?q=${encodeURIComponent(query)}&type=collections`}
            className={`px-4 py-2 rounded-md text-small font-medium transition-colors ${
              type === 'stacks' || type === 'collections'
                ? 'bg-jet text-white'
                : 'bg-gray-light text-jet-dark hover:bg-jet/10'
            }`}
          >
            Collections
          </Link>
          <Link
            href={`/search?q=${encodeURIComponent(query)}&type=cards`}
            className={`px-4 py-2 rounded-md text-small font-medium transition-colors ${
              type === 'cards'
                ? 'bg-jet text-white'
                : 'bg-gray-light text-jet-dark hover:bg-jet/10'
            }`}
          >
            Cards
          </Link>
          <Link
            href={`/search?q=${encodeURIComponent(query)}&type=users`}
            className={`px-4 py-2 rounded-md text-small font-medium transition-colors ${
              type === 'users'
                ? 'bg-jet text-white'
                : 'bg-gray-light text-jet-dark hover:bg-jet/10'
            }`}
          >
            Creators
          </Link>
        </div>
      </div>

      {/* Search Results */}
      <Suspense fallback={<StackGridSkeleton count={12} />}>
        <SearchResults query={query} type={type} />
      </Suspense>
    </div>
  );
}

