import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { createServiceClient } from '@/lib/supabase/api-service';
import { rateLimiters, checkRateLimit, getRateLimitIdentifier, getIpAddress } from '@/lib/rate-limit';
import { checkUserCardLimit } from '@/lib/monitoring/alerts';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - Please log in again' },
        { status: 401 }
      );
    }

    // Rate limiting: 20 cards/day per user (PRD requirement)
    const ipAddress = getIpAddress(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimitResult = await checkRateLimit(rateLimiters.cards, identifier);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. You can create up to 20 cards per day.',
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.reset,
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          },
        }
      );
    }

    // Check for monitoring alerts (cards per user)
    // This runs asynchronously and doesn't block the request
    checkUserCardLimit(user.id, supabase).catch(err => {
      console.error('Error checking user card limit:', err);
    });

    // Use service client for card creation to bypass RLS if needed
    // This ensures card creation works even if RLS policy has issues
    const serviceClient = createServiceClient();

    const { url, title, description, thumbnail_url, collection_id, stack_id, is_public, source } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Determine source if not provided
    const id = collection_id || stack_id;
    const attributionSource = source || (id ? 'collection' : 'manual');

    // Check if user is a stacqer/admin (can publish standalone public cards)
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    
    const isStacker = userProfile?.role === 'stacker' || userProfile?.role === 'admin';
    
    // Determine card visibility based on user role and collection visibility
    let cardIsPublic = false;
    
    if (id) {
      // Card is being added to a collection/stack - check collection visibility
      const { data: collection } = await supabase
        .from('collections')
        .select('is_public, owner_id')
        .eq('id', id)
        .maybeSingle();
      
      // Fallback to stacks table if not found in collections (legacy support)
      let stackData = null;
      if (!collection) {
        const { data: stack } = await supabase
          .from('stacks')
          .select('is_public, owner_id')
          .eq('id', id)
          .maybeSingle();
        stackData = stack;
      }
      
      const targetCollection = collection || stackData;
      
      if (targetCollection) {
        // Card visibility matches collection visibility
        cardIsPublic = targetCollection.is_public === true;
      } else {
        // Collection not found - default to private for safety
        cardIsPublic = false;
      }
    } else {
      // Standalone card (not in a collection)
      // Only stacqers can create standalone public cards
      if (isStacker) {
        // Stacqers can set is_public as they wish
        cardIsPublic = is_public !== undefined ? is_public : false;
      } else {
        // Regular users cannot create standalone public cards
        cardIsPublic = false;
        
        // Warn if they tried to set it to public
        if (is_public === true) {
          console.warn(`User ${user.id} attempted to create standalone public card but is not a stacqer`);
        }
      }
    }

    // Canonicalize URL using normalize-url library
    const { canonicalizeUrl } = await import('@/lib/metadata/extractor');
    const normalizedUrl = canonicalizeUrl(url);
    
    // Process Amazon affiliate links in the background (async, non-blocking)
    // This function will be called after card is created
    const processAffiliateLink = async (cardIdToUpdate: string, existingMetadata: any = {}) => {
      try {
        const { isAmazonLink, addAmazonAffiliateTag, getAmazonAffiliateConfig } = await import('@/lib/affiliate/amazon');
        const config = getAmazonAffiliateConfig();
        
        if (config && isAmazonLink(normalizedUrl)) {
          const affiliateUrl = addAmazonAffiliateTag(normalizedUrl, config);
          
          // Update the card with affiliate URL if it was created and different
          if (affiliateUrl && affiliateUrl !== normalizedUrl) {
            await serviceClient
              .from('cards')
              .update({ 
                metadata: { 
                  ...existingMetadata,
                  affiliate_url: affiliateUrl,
                  is_amazon_product: true,
                } 
              })
              .eq('id', cardIdToUpdate)
              .then(() => {
                // Silently succeed - this is background processing
              })
              .catch(() => {
                // Silently fail - don't log to avoid noise
                // Affiliate link processing is optional
              });
          }
        }
      } catch (error) {
        // Silently fail - affiliate processing is optional and shouldn't block card creation
      }
    };

    // Check if card already exists, use INSERT ... ON CONFLICT pattern
    const domain = new URL(normalizedUrl).hostname.replace('www.', '');
    
    // Insert or get existing card
    const { data: card, error: cardError } = await serviceClient
      .from('cards')
      .insert({
        canonical_url: normalizedUrl,
        title: title || null,
        description: description || null,
        thumbnail_url: thumbnail_url || null,
        domain,
        created_by: user.id,
        status: 'active',
        is_public: cardIsPublic,
        metadata: {}, // Initialize metadata for affiliate URL storage
      })
      .select()
      .single();

    let cardId: string;
    
    if (cardError) {
      // If conflict (duplicate canonical_url), fetch existing card
      if (cardError.code === '23505') {
        const { data: existingCard } = await supabase
          .from('cards')
          .select('id, metadata')
          .eq('canonical_url', normalizedUrl)
          .single();
        
        if (existingCard) {
          cardId = existingCard.id;
          // Update affiliate link for existing card if needed (background)
          processAffiliateLink(cardId, existingCard.metadata || {});
        } else {
          return NextResponse.json(
            { error: 'Failed to create or find card' },
            { status: 400 }
          );
        }
      } else {
        console.error('Card creation error details:', {
          message: cardError.message,
          details: cardError.details,
          hint: cardError.hint,
          code: cardError.code,
          user_id: user.id,
        });
        return NextResponse.json(
          { 
            error: cardError.message || 'Failed to create card',
            hint: 'Make sure you have run migration 026_stackers_and_standalone_cards.sql in Supabase'
          },
          { status: 400 }
        );
      }
    } else {
      cardId = card.id;
      // Process affiliate link for newly created card (background)
      processAffiliateLink(cardId, card.metadata || {});
    }

    // Create card attribution (always)
    const { error: attributionError } = await serviceClient
      .from('card_attributions')
      .insert({
        card_id: cardId,
        user_id: user.id,
        source: attributionSource,
        collection_id: collection_id || null,
        stack_id: stack_id || null, // Legacy support
      });

    if (attributionError && attributionError.code !== '23505') { // Ignore duplicate attribution errors
      console.error('Attribution creation error:', attributionError);
      // Don't fail the request if attribution fails, but log it
    }

    // Add card to collection if collection_id provided
    if (collection_id || stack_id) {
      const targetId = collection_id || stack_id;
      const tableName = collection_id ? 'collection_cards' : 'stack_cards';
      const idField = collection_id ? 'collection_id' : 'stack_id';
      
      const { data: existingMapping } = await serviceClient
        .from(tableName)
        .select('id')
        .eq(idField, targetId)
        .eq('card_id', cardId)
        .maybeSingle();

      if (!existingMapping) {
        const insertData: any = {
          [idField]: targetId,
          card_id: cardId,
          added_by: user.id,
        };
        
        const { error: mappingError } = await serviceClient
          .from(tableName)
          .insert(insertData);

        if (mappingError) {
          return NextResponse.json(
            { error: mappingError.message },
            { status: 400 }
          );
        }
      }
    }

    // Trigger metadata worker asynchronously (don't wait for it)
    // This ensures cards get full metadata processing in the background
    if (!cardError || cardError.code === '23505') {
      // Trigger for new cards or if metadata might be missing
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/workers/fetch-metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.WORKER_API_KEY && { 'x-api-key': process.env.WORKER_API_KEY }),
        },
        body: JSON.stringify({ card_id: cardId }),
      }).catch(err => {
        // Silently fail - worker will pick it up later
        console.error('Failed to trigger metadata worker:', err);
      });
    }

    // Fetch card with attributions for response
    const { data: cardWithAttributions } = await supabase
      .from('cards')
      .select(`
        *,
        attributions:card_attributions (
          id,
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
        )
      `)
      .eq('id', cardId)
      .single();

    return NextResponse.json({ 
      success: true, 
      card: cardWithAttributions,
      card_id: cardId 
    });
  } catch (error) {
    console.error('Error in cards route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

