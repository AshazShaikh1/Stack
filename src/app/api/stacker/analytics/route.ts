import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { createServiceClient } from '@/lib/supabase/api-service';

/**
 * GET /api/stacker/analytics
 * Get comprehensive analytics for Stacqers
 * Only accessible to users with 'stacker' or 'admin' role
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is a stacqer or admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userProfile?.role !== 'stacker' && userProfile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Stacqer access required' },
        { status: 403 }
      );
    }

    const serviceClient = createServiceClient();

    // Get date range (default to last 30 days)
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30', 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Overview Stats
    const [
      collectionsResult,
      cardsResult,
      upvotesResult,
      savesResult,
      commentsResult,
      totalViewsResult,
    ] = await Promise.all([
      // Total collections
      serviceClient
        .from('collections')
        .select('id, created_at, stats, is_public', { count: 'exact' })
        .eq('owner_id', user.id),
      
      // Total cards
      serviceClient
        .from('cards')
        .select('id, created_at, is_public', { count: 'exact' })
        .eq('created_by', user.id),
      
      // Total upvotes received
      serviceClient
        .from('votes')
        .select('id, created_at', { count: 'exact' })
        .in('target_type', ['collection', 'card'])
        .then(async (result: any) => {
          if (result.error) return result;
          
          // Get collections and cards owned by user
          const { data: userCollections } = await serviceClient
            .from('collections')
            .select('id')
            .eq('owner_id', user.id);
          
          const { data: userCards } = await serviceClient
            .from('cards')
            .select('id')
            .eq('created_by', user.id);
          
          const collectionIds = (userCollections || []).map((c: any) => c.id);
          const cardIds = (userCards || []).map((c: any) => c.id);
          
          // Filter votes for user's content
          const { data: votes } = await serviceClient
            .from('votes')
            .select('id, created_at, target_id, target_type')
            .in('target_type', ['collection', 'card']);
          
          const userVotes = (votes || []).filter((v: any) => 
            (v.target_type === 'collection' && collectionIds.includes(v.target_id)) ||
            (v.target_type === 'card' && cardIds.includes(v.target_id))
          );
          
          return { data: userVotes, count: userVotes.length, error: null };
        }),
      
      // Total saves received
      serviceClient
        .from('saves')
        .select('id, created_at', { count: 'exact' })
        .then(async (result: any) => {
          if (result.error) return result;
          
          // Get collections owned by user
          const { data: userCollections } = await serviceClient
            .from('collections')
            .select('id')
            .eq('owner_id', user.id);
          
          const collectionIds = (userCollections || []).map((c: any) => c.id);
          
          // Filter saves for user's collections
          const { data: saves } = await serviceClient
            .from('saves')
            .select('id, created_at, collection_id')
            .in('collection_id', collectionIds);
          
          return { data: saves, count: saves?.length || 0, error: null };
        }),
      
      // Total comments received
      serviceClient
        .from('comments')
        .select('id, created_at', { count: 'exact' })
        .in('target_type', ['collection', 'card'])
        .then(async (result: any) => {
          if (result.error) return result;
          
          // Get collections and cards owned by user
          const { data: userCollections } = await serviceClient
            .from('collections')
            .select('id')
            .eq('owner_id', user.id);
          
          const { data: userCards } = await serviceClient
            .from('cards')
            .select('id')
            .eq('created_by', user.id);
          
          const collectionIds = (userCollections || []).map((c: any) => c.id);
          const cardIds = (userCards || []).map((c: any) => c.id);
          
          // Filter comments for user's content
          const { data: comments } = await serviceClient
            .from('comments')
            .select('id, created_at, target_id, target_type')
            .in('target_type', ['collection', 'card']);
          
          const userComments = (comments || []).filter((c: any) => 
            (c.target_type === 'collection' && collectionIds.includes(c.target_id)) ||
            (c.target_type === 'card' && cardIds.includes(c.target_id))
          );
          
          return { data: userComments, count: userComments.length, error: null };
        }),
      
      // Total views (sum of collection stats.views)
      serviceClient
        .from('collections')
        .select('stats')
        .eq('owner_id', user.id)
        .then((result: any) => {
          if (result.error) return result;
          const totalViews = (result.data || []).reduce((sum: number, c: any) => {
            return sum + ((c.stats?.views || 0) as number);
          }, 0);
          return { data: null, count: totalViews, error: null };
        }),
    ]);

    // Time series data for charts
    const timeSeriesData = await getTimeSeriesData(serviceClient, user.id, startDate, days);

    // Top performing collections
    const topCollections = await getTopCollections(serviceClient, user.id, 10);

    // Top performing cards
    const topCards = await getTopCards(serviceClient, user.id, 10);

    // Engagement metrics
    const engagementMetrics = await getEngagementMetrics(serviceClient, user.id, startDate);

    return NextResponse.json({
      overview: {
        collections: collectionsResult.count || 0,
        cards: cardsResult.count || 0,
        upvotes: upvotesResult.count || 0,
        saves: savesResult.count || 0,
        comments: commentsResult.count || 0,
        views: totalViewsResult.count || 0,
      },
      timeSeries: timeSeriesData,
      topCollections,
      topCards,
      engagement: engagementMetrics,
    });
  } catch (error: any) {
    console.error('Error in stacker analytics route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get time series data for charts
 */
async function getTimeSeriesData(
  serviceClient: any,
  userId: string,
  startDate: Date,
  days: number
) {
  const data: Record<string, any> = {
    collections: [],
    cards: [],
    upvotes: [],
    saves: [],
    comments: [],
    views: [],
  };

  // Initialize date buckets
  const buckets: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    buckets.push(date.toISOString().split('T')[0]);
  }

  // Get collections created over time
  const { data: collections } = await serviceClient
    .from('collections')
    .select('created_at')
    .eq('owner_id', userId)
    .gte('created_at', startDate.toISOString());

  // Get cards created over time
  const { data: cards } = await serviceClient
    .from('cards')
    .select('created_at')
    .eq('created_by', userId)
    .gte('created_at', startDate.toISOString());

  // Get upvotes over time (need to query votes for user's content)
  const { data: userCollections } = await serviceClient
    .from('collections')
    .select('id')
    .eq('owner_id', userId);
  
  const { data: userCards } = await serviceClient
    .from('cards')
    .select('id')
    .eq('created_by', userId);
  
  const collectionIds = (userCollections || []).map((c: any) => c.id);
  const cardIds = (userCards || []).map((c: any) => c.id);

  const { data: votes } = await serviceClient
    .from('votes')
    .select('created_at, target_id, target_type')
    .in('target_type', ['collection', 'card'])
    .gte('created_at', startDate.toISOString());

  const userVotes = (votes || []).filter((v: any) => 
    (v.target_type === 'collection' && collectionIds.includes(v.target_id)) ||
    (v.target_type === 'card' && cardIds.includes(v.target_id))
  );

  const { data: saves } = await serviceClient
    .from('saves')
    .select('created_at, collection_id')
    .in('collection_id', collectionIds)
    .gte('created_at', startDate.toISOString());

  const { data: comments } = await serviceClient
    .from('comments')
    .select('created_at, target_id, target_type')
    .in('target_type', ['collection', 'card'])
    .gte('created_at', startDate.toISOString());

  const userComments = (comments || []).filter((c: any) => 
    (c.target_type === 'collection' && collectionIds.includes(c.target_id)) ||
    (c.target_type === 'card' && cardIds.includes(c.target_id))
  );

  // Get views over time (from collection stats)
  const { data: collectionsWithStats } = await serviceClient
    .from('collections')
    .select('created_at, stats')
    .eq('owner_id', userId)
    .gte('created_at', startDate.toISOString());

  // Aggregate by date
  buckets.forEach((date) => {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    data.collections.push({
      date,
      value: (collections || []).filter((c: any) => {
        const created = new Date(c.created_at);
        return created >= dateStart && created <= dateEnd;
      }).length,
    });

    data.cards.push({
      date,
      value: (cards || []).filter((c: any) => {
        const created = new Date(c.created_at);
        return created >= dateStart && created <= dateEnd;
      }).length,
    });

    data.upvotes.push({
      date,
      value: (userVotes || []).filter((v: any) => {
        const created = new Date(v.created_at);
        return created >= dateStart && created <= dateEnd;
      }).length,
    });

    data.saves.push({
      date,
      value: (saves || []).filter((s: any) => {
        const created = new Date(s.created_at);
        return created >= dateStart && created <= dateEnd;
      }).length,
    });

    data.comments.push({
      date,
      value: (userComments || []).filter((c: any) => {
        const created = new Date(c.created_at);
        return created >= dateStart && created <= dateEnd;
      }).length,
    });

    // Views are cumulative, so we estimate daily views from collection creation
    // This is a simplified approach - in production you might track views separately
    data.views.push({
      date,
      value: 0, // Views are tracked in stats, not per-day, so we'll show cumulative
    });
  });

  return data;
}

/**
 * Get top performing collections
 */
async function getTopCollections(serviceClient: any, userId: string, limit: number) {
  const { data: collections } = await serviceClient
    .from('collections')
    .select('id, title, slug, stats, created_at, is_public')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit * 2); // Get more to sort by engagement

  if (!collections) return [];

  // Sort by engagement score (upvotes + saves + comments)
  const sorted = collections
    .map((c: any) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      stats: c.stats || {},
      created_at: c.created_at,
      is_public: c.is_public,
      engagement: 
        (c.stats?.upvotes || 0) +
        (c.stats?.saves || 0) +
        (c.stats?.comments || 0),
    }))
    .sort((a: any, b: any) => b.engagement - a.engagement)
    .slice(0, limit);

  return sorted;
}

/**
 * Get top performing cards
 */
async function getTopCards(serviceClient: any, userId: string, limit: number) {
  // Get cards created by user and their engagement
  const { data: cards } = await serviceClient
    .from('cards')
    .select('id, title, canonical_url, created_at, is_public')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(limit * 2);

  if (!cards) return [];

  // Get upvotes and saves for these cards
  const cardIds = cards.map((c: any) => c.id);
  
  const [upvotesResult, savesResult, commentsResult] = await Promise.all([
    serviceClient
      .from('votes')
      .select('target_id')
      .eq('target_type', 'card')
      .in('target_id', cardIds),
    serviceClient
      .from('saves')
      .select('card_id')
      .in('card_id', cardIds),
    serviceClient
      .from('comments')
      .select('target_id')
      .eq('target_type', 'card')
      .in('target_id', cardIds),
  ]);

  const upvoteCounts: Record<string, number> = {};
  (upvotesResult.data || []).forEach((v: any) => {
    upvoteCounts[v.target_id] = (upvoteCounts[v.target_id] || 0) + 1;
  });

  const saveCounts: Record<string, number> = {};
  (savesResult.data || []).forEach((s: any) => {
    saveCounts[s.card_id] = (saveCounts[s.card_id] || 0) + 1;
  });

  const commentCounts: Record<string, number> = {};
  (commentsResult.data || []).forEach((c: any) => {
    commentCounts[c.target_id] = (commentCounts[c.target_id] || 0) + 1;
  });

  const sorted = cards
    .map((c: any) => ({
      id: c.id,
      title: c.title || 'Untitled',
      url: c.canonical_url,
      created_at: c.created_at,
      is_public: c.is_public,
      upvotes: upvoteCounts[c.id] || 0,
      saves: saveCounts[c.id] || 0,
      comments: commentCounts[c.id] || 0,
      engagement: 
        (upvoteCounts[c.id] || 0) +
        (saveCounts[c.id] || 0) +
        (commentCounts[c.id] || 0),
    }))
    .sort((a: any, b: any) => b.engagement - a.engagement)
    .slice(0, limit);

  return sorted;
}

/**
 * Get engagement metrics
 */
async function getEngagementMetrics(
  serviceClient: any,
  userId: string,
  startDate: Date
) {
  const { data: collections } = await serviceClient
    .from('collections')
    .select('stats, created_at')
    .eq('owner_id', userId)
    .gte('created_at', startDate.toISOString());

  const totalEngagement = (collections || []).reduce(
    (sum: number, c: any) => {
      return (
        sum +
        (c.stats?.upvotes || 0) +
        (c.stats?.saves || 0) +
        (c.stats?.comments || 0)
      );
    },
    0
  );

  const avgEngagementPerCollection =
    collections && collections.length > 0
      ? totalEngagement / collections.length
      : 0;

  return {
    totalEngagement,
    avgEngagementPerCollection: Math.round(avgEngagementPerCollection * 100) / 100,
    collectionsCount: collections?.length || 0,
  };
}
