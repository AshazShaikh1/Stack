import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { cachedJsonResponse } from '@/lib/cache/headers';
import { cached, CacheKeys, CACHE_TTL } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const typeParam = searchParams.get('type') || 'all'; // all, collections, cards, users (support legacy 'stacks')
    const type = typeParam === 'stacks' ? 'collections' : typeParam;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const searchQuery = q.trim();
    const results: any = {
      collections: [],
      cards: [],
      users: [],
      total: 0,
    };

    // Search Collections (support legacy 'stacks' type)
    if (type === 'all' || type === 'collections') {
      const { data: collections, error: collectionsError } = await supabase
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
        .range(offset, offset + limit - 1);

      if (!collectionsError && collections) {
        results.collections = collections;
      }
    }

    // Search Cards
    if (type === 'all' || type === 'cards') {
      const { data: cards, error: cardsError } = await supabase
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
        .range(offset, offset + limit - 1);

      if (!cardsError && cards) {
        results.cards = cards;
      }
    }

    // Search Users (using pg_trgm for fuzzy matching on username and display_name)
    if (type === 'all' || type === 'users') {
      // Use similarity search with pg_trgm
      const { data: users, error: usersError } = await supabase
        .rpc('search_users', {
          search_term: searchQuery,
          result_limit: limit,
          result_offset: offset,
        });

      // Fallback to simple ILIKE if RPC function doesn't exist
      if (usersError) {
        const { data: fallbackUsers, error: fallbackError } = await supabase
          .from('users')
          .select(`
            id,
            username,
            display_name,
            avatar_url
          `)
          .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
          .limit(limit)
          .range(offset, offset + limit - 1);

        if (!fallbackError && fallbackUsers) {
          results.users = fallbackUsers;
        }
      } else if (users) {
        results.users = users;
      }
    }

    results.total = 
      (results.collections?.length || 0) + 
      (results.cards?.length || 0) + 
      (results.users?.length || 0);

    // Cache search results (longer TTL since search queries change less frequently)
    return cachedJsonResponse(results, 'SEARCH');
  } catch (error) {
    console.error('Error in search route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

