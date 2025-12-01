import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';

/**
 * GET /api/feed
 * Returns mixed feed of cards and stacks based on ranking
 * 
 * Query params:
 * - type: 'card' | 'stack' | 'both' (default: 'both')
 * - mix: 'cards:0.6,stacks:0.4' (default ratio)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { searchParams } = new URL(request.url);
    
    const type = searchParams.get('type') || 'both';
    const mixParam = searchParams.get('mix') || 'cards:0.6,stacks:0.4';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Parse mix ratios
    const mixRatios: Record<string, number> = {};
    mixParam.split(',').forEach(part => {
      const [key, value] = part.split(':');
      if (key && value) {
        mixRatios[key.trim()] = parseFloat(value.trim());
      }
    });

    const cardsRatio = mixRatios.cards || 0.6;
    const stacksRatio = mixRatios.stacks || 0.4;
    const totalRatio = cardsRatio + stacksRatio;
    
    // Normalize ratios
    const normalizedCardsRatio = cardsRatio / totalRatio;
    const normalizedStacksRatio = stacksRatio / totalRatio;

    // Fetch a larger pool of items to ensure proper mixing by score
    // We'll fetch 2x the limit to have enough items to mix properly
    const fetchLimit = limit * 2;
    const cardsLimit = type === 'both' ? Math.ceil(fetchLimit * normalizedCardsRatio) : (type === 'card' ? limit : 0);
    const stacksLimit = type === 'both' ? Math.ceil(fetchLimit * normalizedStacksRatio) : (type === 'stack' ? limit : 0);

    const results: any[] = [];

    // Fetch ranked cards - fetch from the same offset range to ensure proper mixing
    if (type === 'card' || type === 'both') {
      const { data: rankedItems, error: itemsError } = await supabase
        .from('explore_ranking_items')
        .select('item_id, norm_score')
        .eq('item_type', 'card')
        .order('norm_score', { ascending: false })
        .range(0, cardsLimit - 1); // Start from 0 to get top-ranked cards

      let cardIds: string[] = [];
      
      if (!itemsError && rankedItems && rankedItems.length > 0) {
        // Use ranked items if available
        cardIds = rankedItems.map(item => item.item_id);
      } else {
        // Fallback: get recent public cards if ranking table is empty
        const { data: recentCards } = await supabase
          .from('cards')
          .select('id')
          .eq('is_public', true)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(cardsLimit);
        
        if (recentCards) {
          cardIds = recentCards.map(c => c.id);
        }
      }
      
      if (cardIds.length > 0) {
        const { data: cards, error: cardsError } = await supabase
          .from('cards')
          .select(`
            id,
            canonical_url,
            title,
            description,
            thumbnail_url,
            domain,
            is_public,
            visits_count,
            saves_count,
            upvotes_count,
            comments_count,
            created_at,
            created_by,
            creator:users!cards_created_by_fkey (
              id,
              username,
              display_name,
              avatar_url
            )
          `)
          .in('id', cardIds)
          .eq('is_public', true);

        // Fetch attributions separately
        if (!cardsError && cards) {
          const { data: attributions } = await supabase
            .from('card_attributions')
            .select(`
              id,
              card_id,
              user_id,
              source,
              stack_id,
              created_at,
              user:users!card_attributions_user_id_fkey (
                id,
                username,
                display_name,
                avatar_url
              )
            `)
            .in('card_id', cardIds);

          // Map attributions to cards
          const attributionsMap = new Map();
          attributions?.forEach(attr => {
            if (!attributionsMap.has(attr.card_id)) {
              attributionsMap.set(attr.card_id, []);
            }
            attributionsMap.get(attr.card_id).push(attr);
          });

          // Create score map (use 0 if not in ranking)
          const scoreMap = new Map(rankedItems?.map(item => [item.item_id, item.norm_score]) || []);

          cards.forEach(card => {
            results.push({
              type: 'card',
              ...card,
              attributions: attributionsMap.get(card.id) || [],
              score: scoreMap.get(card.id) || 0,
            });
          });
        }
      }
    }

    // Fetch ranked stacks - fetch from the same offset range to ensure proper mixing
    if (type === 'stack' || type === 'both') {
      const { data: rankedItems, error: itemsError } = await supabase
        .from('explore_ranking_items')
        .select('item_id, norm_score')
        .eq('item_type', 'stack')
        .order('norm_score', { ascending: false })
        .range(0, stacksLimit - 1); // Start from 0 to get top-ranked stacks

      let stackIds: string[] = [];
      
      if (!itemsError && rankedItems && rankedItems.length > 0) {
        // Use ranked items if available
        stackIds = rankedItems.map(item => item.item_id);
      } else {
        // Fallback: get recent public stacks if ranking table is empty
        const { data: recentStacks } = await supabase
          .from('stacks')
          .select('id')
          .eq('is_public', true)
          .eq('is_hidden', false)
          .order('created_at', { ascending: false })
          .limit(stacksLimit);
        
        if (recentStacks) {
          stackIds = recentStacks.map(s => s.id);
        }
      }
      
      if (stackIds.length > 0) {
        const { data: stacks, error: stacksError } = await supabase
          .from('stacks')
          .select(`
            id,
            title,
            description,
            slug,
            cover_image_url,
            is_public,
            stats,
            created_at,
            owner_id,
            owner:users!stacks_owner_id_fkey (
              id,
              username,
              display_name,
              avatar_url
            )
          `)
          .in('id', stackIds)
          .eq('is_public', true)
          .eq('is_hidden', false);

        if (!stacksError && stacks) {
          // Create score map (use 0 if not in ranking)
          const scoreMap = new Map(rankedItems?.map(item => [item.item_id, item.norm_score]) || []);

          stacks.forEach(stack => {
            results.push({
              type: 'stack',
              ...stack,
              score: scoreMap.get(stack.id) || 0,
            });
          });
        }
      }
    }

    // Sort ALL results by score (descending) - this properly mixes cards and stacks
    const sortedResults = results.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Dedupe canonical cards while preserving score-based order
    const dedupedResults: any[] = [];
    const seenCardUrls = new Set<string>();

    sortedResults.forEach(item => {
      if (item.type === 'card') {
        // For cards, show first occurrence with all attributions
        if (!seenCardUrls.has(item.canonical_url)) {
          seenCardUrls.add(item.canonical_url);
          dedupedResults.push(item);
        } else {
          // Merge attributions into existing card (keep the one with higher score)
          const existing = dedupedResults.find(r => r.type === 'card' && r.canonical_url === item.canonical_url);
          if (existing && item.attributions) {
            // Only merge if the new one has a higher score
            if ((item.score || 0) > (existing.score || 0)) {
              existing.attributions = [...(existing.attributions || []), ...item.attributions];
              existing.score = item.score; // Update to higher score
            } else {
              existing.attributions = [...(existing.attributions || []), ...item.attributions];
            }
          }
        }
      } else {
        dedupedResults.push(item);
      }
    });

    // Re-sort after deduplication to maintain score order
    dedupedResults.sort((a, b) => (b.score || 0) - (a.score || 0));

    return NextResponse.json({
      feed: dedupedResults.slice(0, limit),
      total: dedupedResults.length,
    });
  } catch (error) {
    console.error('Error in feed route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

