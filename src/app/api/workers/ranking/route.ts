import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/api-service';

/**
 * POST /api/workers/ranking
 * Compute ranking scores for cards and stacks
 * 
 * Formula:
 * base = w_u*ln(1+U) + w_s*ln(1+S) + w_c*ln(1+C) + w_v*ln(1+V)
 * creator_factor = 1 + (Q/100)
 * promo_factor = 1 + P
 * age_factor = exp(-lambda * A)
 * raw_score = base * creator_factor * promo_factor * age_factor * f_abuse
 * 
 * Default weights:
 * Cards: w_u=1.0, w_s=2.0, w_c=2.5, w_v=1.5, half_life_hours=48
 * Stacks: w_u=0.8, w_s=3.0, w_c=2.0, w_v=0.0, half_life_hours=168
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is called from an authorized source
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.WORKER_API_KEY;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();
    const results: Record<string, any> = {
      cards_processed: 0,
      stacks_processed: 0,
      errors: [],
    };

    // Ranking weights
    const cardWeights = {
      w_u: 1.0,
      w_s: 2.0,
      w_c: 2.5,
      w_v: 1.5,
      half_life_hours: 48,
    };

    const stackWeights = {
      w_u: 0.8,
      w_s: 3.0,
      w_c: 2.0,
      w_v: 0.0,
      half_life_hours: 168,
    };

    const lambdaCards = Math.log(2) / cardWeights.half_life_hours;
    const lambdaStacks = Math.log(2) / stackWeights.half_life_hours;

    // Process cards
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select(`
        id,
        upvotes_count,
        saves_count,
        comments_count,
        visits_count,
        created_at,
        created_by,
        is_public
      `)
      .eq('is_public', true)
      .eq('status', 'active');

    if (!cardsError && cards) {
      for (const card of cards) {
        try {
          const U = card.upvotes_count || 0;
          const S = card.saves_count || 0;
          const C = card.comments_count || 0;
          const V = card.visits_count || 0;
          
          const ageHours = (Date.now() - new Date(card.created_at).getTime()) / (1000 * 60 * 60);
          
          // Get creator quality score
          let Q = 50; // Default
          if (card.created_by) {
            const { data: creator } = await supabase
              .from('users')
              .select('quality_score')
              .eq('id', card.created_by)
              .single();
            Q = creator?.quality_score || 50;
          }

          // Base score
          const base = 
            cardWeights.w_u * Math.log(1 + U) +
            cardWeights.w_s * Math.log(1 + S) +
            cardWeights.w_c * Math.log(1 + C) +
            cardWeights.w_v * Math.log(1 + V);

          // Factors
          const creatorFactor = 1 + (Q / 100);
          const promoFactor = 1; // Cards don't have promotion yet
          const ageFactor = Math.exp(-lambdaCards * ageHours);
          const abuseFactor = 1; // TODO: Get from fraud detection

          const rawScore = base * creatorFactor * promoFactor * ageFactor * abuseFactor;

          // Upsert ranking
          await supabase
            .from('explore_ranking_items')
            .upsert({
              item_type: 'card',
              item_id: card.id,
              raw_score,
              norm_score: rawScore, // Will be normalized in next step
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'item_type,item_id',
            });

          results.cards_processed++;
        } catch (error: any) {
          results.errors.push({ card_id: card.id, error: error.message });
        }
      }
    }

    // Process stacks
    const { data: stacks, error: stacksError } = await supabase
      .from('stacks')
      .select(`
        id,
        stats,
        created_at,
        owner_id,
        promoted_until
      `)
      .eq('is_public', true)
      .eq('is_hidden', false);

    if (!stacksError && stacks) {
      for (const stack of stacks) {
        try {
          const stats = stack.stats || {};
          const U = stats.upvotes || 0;
          const S = stats.saves || 0;
          const C = stats.comments || 0;
          const V = 0; // Stacks don't track visits_count
          
          const ageHours = (Date.now() - new Date(stack.created_at).getTime()) / (1000 * 60 * 60);
          
          // Get owner quality score
          let Q = 50;
          if (stack.owner_id) {
            const { data: owner } = await supabase
              .from('users')
              .select('quality_score')
              .eq('id', stack.owner_id)
              .single();
            Q = owner?.quality_score || 50;
          }

          // Promotion boost
          const P = stack.promoted_until && new Date(stack.promoted_until) > new Date() ? 0.5 : 0;

          // Base score
          const base = 
            stackWeights.w_u * Math.log(1 + U) +
            stackWeights.w_s * Math.log(1 + S) +
            stackWeights.w_c * Math.log(1 + C) +
            stackWeights.w_v * Math.log(1 + V);

          // Factors
          const creatorFactor = 1 + (Q / 100);
          const promoFactor = 1 + P;
          const ageFactor = Math.exp(-lambdaStacks * ageHours);
          const abuseFactor = 1; // TODO: Get from fraud detection

          const rawScore = base * creatorFactor * promoFactor * ageFactor * abuseFactor;

          // Upsert ranking
          await supabase
            .from('explore_ranking_items')
            .upsert({
              item_type: 'stack',
              item_id: stack.id,
              raw_score,
              norm_score: rawScore, // Will be normalized in next step
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'item_type,item_id',
            });

          results.stacks_processed++;
        } catch (error: any) {
          results.errors.push({ stack_id: stack.id, error: error.message });
        }
      }
    }

    // Normalize scores (compute mean and stddev, then normalize)
    const { data: allScores } = await supabase
      .from('explore_ranking_items')
      .select('item_type, item_id, raw_score')
      .order('updated_at', { ascending: false })
      .limit(10000); // Recent items only

    if (allScores && allScores.length > 0) {
      const scores = allScores.map(r => r.raw_score || 0);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
      const stddev = Math.sqrt(variance);

      // Update normalized scores in batch
      const updates = allScores.map(item => {
        const normScore = stddev > 0 ? ((item.raw_score || 0) - mean) / stddev : 0;
        return {
          item_type: item.item_type,
          item_id: item.item_id,
          norm_score: normScore,
        };
      });

      // Batch upsert
      for (const update of updates) {
        await supabase
          .from('explore_ranking_items')
          .upsert(update, {
            onConflict: 'item_type,item_id',
          });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in ranking worker:', error);
    return NextResponse.json(
      { error: 'Failed to compute rankings' },
      { status: 500 }
    );
  }
}

