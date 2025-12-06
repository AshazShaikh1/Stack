import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { createServiceClient } from '@/lib/supabase/api-service';
import { rateLimiters, checkRateLimit, getRateLimitIdentifier, getIpAddress } from '@/lib/rate-limit';

/**
 * POST /api/stacks/[id]/clone
 * Clone a public stack as a private stack for the current user
 * 
 * Requirements:
 * - Stack must be public (is_public = true)
 * - User must be authenticated
 * - Rate limit: 10 clones/day per user
 * - Clone is private by default (is_public = false)
 * - Copies: title, description, cover_image_url, tags, and all cards
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting: 10 clones/day per user (PRD requirement)
    const ipAddress = getIpAddress(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimitResult = await checkRateLimit(rateLimiters.clones, identifier);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. You can clone up to 10 collections per day.',
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

    // Fetch the original stack (try by id first, then by slug)
    let { data: originalStack, error: stackError } = await supabase
      .from('stacks')
      .select(`
        id,
        title,
        description,
        cover_image_url,
        is_public,
        owner_id
      `)
      .eq('id', id)
      .maybeSingle();

    // If not found by id, try by slug
    if (!originalStack && !stackError) {
      const { data: stackBySlug, error: slugError } = await supabase
        .from('stacks')
        .select(`
          id,
          title,
          description,
          cover_image_url,
          is_public,
          owner_id
        `)
        .eq('slug', id)
        .maybeSingle();
      
      originalStack = stackBySlug;
      stackError = slugError;
    }

    if (stackError || !originalStack) {
      return NextResponse.json(
        { error: 'Stack not found' },
        { status: 404 }
      );
    }

    // Only allow cloning public stacks
    if (!originalStack.is_public) {
      return NextResponse.json(
        { error: 'Only public stacks can be cloned' },
        { status: 403 }
      );
    }

    // Prevent users from cloning their own stacks
    if (originalStack.owner_id === user.id) {
      return NextResponse.json(
        { error: 'You cannot clone your own stack' },
        { status: 400 }
      );
    }

    // Check if user already cloned this stack
    const { data: existingClone } = await supabase
      .from('clones')
      .select('id')
      .eq('cloner_id', user.id)
      .eq('original_stack_id', id)
      .maybeSingle();

    if (existingClone) {
      return NextResponse.json(
        { error: 'You have already cloned this stack' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    // Generate unique slug
    const baseSlug = originalStack.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    
    let slug = `${baseSlug}-${Date.now()}`;
    let slugExists = true;
    let attempts = 0;

    // Ensure slug is unique
    while (slugExists && attempts < 10) {
      const { data: existing } = await serviceClient
        .from('stacks')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      
      if (!existing) {
        slugExists = false;
      } else {
        slug = `${baseSlug}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        attempts++;
      }
    }

    // Create the cloned stack (private by default)
    const { data: clonedStack, error: createError } = await serviceClient
      .from('stacks')
      .insert({
        owner_id: user.id,
        title: `${originalStack.title} (Clone)`,
        description: originalStack.description,
        cover_image_url: originalStack.cover_image_url,
        slug,
        is_public: false, // Clones are private by default
        is_hidden: false,
        stats: { views: 0, upvotes: 0, saves: 0, comments: 0 },
      })
      .select()
      .single();

    if (createError || !clonedStack) {
      console.error('Error creating cloned stack:', createError);
      return NextResponse.json(
        { error: 'Failed to create cloned stack' },
        { status: 500 }
      );
    }

    // Copy tags from original stack
    const { data: originalTags } = await supabase
      .from('stack_tags')
      .select('tag_id')
      .eq('stack_id', id);

    if (originalTags && originalTags.length > 0) {
      const tagMappings = originalTags.map((st: any) => ({
        stack_id: clonedStack.id,
        tag_id: st.tag_id,
      }));

      await serviceClient
        .from('stack_tags')
        .insert(tagMappings);
    }

    // Copy all cards from original stack
    const { data: originalCards } = await supabase
      .from('stack_cards')
      .select('card_id')
      .eq('stack_id', id);

    if (originalCards && originalCards.length > 0) {
      const cardMappings = originalCards.map((sc: any) => ({
        stack_id: clonedStack.id,
        card_id: sc.card_id,
        added_by: user.id,
      }));

      await serviceClient
        .from('stack_cards')
        .insert(cardMappings);
    }

    // Create clone record
    await serviceClient
      .from('clones')
      .insert({
        original_stack_id: id,
        new_stack_id: clonedStack.id,
        cloner_id: user.id,
      });

    return NextResponse.json({
      success: true,
      stack: {
        id: clonedStack.id,
        slug: clonedStack.slug,
        title: clonedStack.title,
      },
    });
  } catch (error) {
    console.error('Error in clone route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

