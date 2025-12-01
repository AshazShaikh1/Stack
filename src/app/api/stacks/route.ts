import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { createServiceClient } from '@/lib/supabase/api-service';
import { rateLimiters, checkRateLimit, getRateLimitIdentifier, getIpAddress } from '@/lib/rate-limit';

/**
 * POST /api/stacks
 * Create a new stack
 * 
 * Body:
 * - title: string (required)
 * - description: string (optional)
 * - tags: string[] (optional) - array of tag names
 * - is_public: boolean (default: false)
 * - is_hidden: boolean (default: false)
 * - cover_image_url: string (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // Rate limiting: 50 stacks/day per user (reasonable limit)
    const ipAddress = getIpAddress(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimitResult = await checkRateLimit(rateLimiters.stacks, identifier);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. You can create up to 50 stacks per day.',
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

    const body = await request.json();
    const { title, description, tags, is_public, is_hidden, cover_image_url } = body;

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be 200 characters or less' },
        { status: 400 }
      );
    }

    if (description && description.length > 1000) {
      return NextResponse.json(
        { error: 'Description must be 1000 characters or less' },
        { status: 400 }
      );
    }

    // Generate slug from title
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    let slug = baseSlug || `stack-${Date.now()}`;
    let slugExists = true;
    let attempts = 0;

    // Ensure slug is unique
    const serviceClient = createServiceClient();
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

    // Create stack
    const { data: stack, error: stackError } = await serviceClient
      .from('stacks')
      .insert({
        owner_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        slug,
        is_public: is_public ?? false,
        is_hidden: is_hidden ?? false,
        cover_image_url: cover_image_url || null,
        stats: { views: 0, upvotes: 0, saves: 0, comments: 0 },
      })
      .select()
      .single();

    if (stackError || !stack) {
      console.error('Error creating stack:', stackError);
      return NextResponse.json(
        { error: stackError?.message || 'Failed to create stack' },
        { status: 500 }
      );
    }

    // Handle tags if provided
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const tagNames = tags
        .map((t: any) => typeof t === 'string' ? t.trim().toLowerCase() : String(t).trim().toLowerCase())
        .filter((t: string) => t.length > 0)
        .slice(0, 10); // Limit to 10 tags

      for (const tagName of tagNames) {
        // Find or create tag
        let { data: tag } = await serviceClient
          .from('tags')
          .select('id')
          .eq('name', tagName)
          .maybeSingle();

        if (!tag) {
          const { data: newTag, error: tagError } = await serviceClient
            .from('tags')
            .insert({ name: tagName })
            .select()
            .maybeSingle();
          
          if (!tagError && newTag) {
            tag = newTag;
          }
        }

        if (tag) {
          await serviceClient.from('stack_tags').insert({
            stack_id: stack.id,
            tag_id: tag.id,
          });
        }
      }
    }

    return NextResponse.json(stack, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/stacks:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stacks
 * Get stacks (with optional filtering)
 * 
 * Query params:
 * - owner_id: filter by owner
 * - is_public: filter by public/private
 * - limit: number of results (default: 20)
 * - offset: pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { searchParams } = new URL(request.url);
    
    const ownerId = searchParams.get('owner_id');
    const isPublic = searchParams.get('is_public');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('stacks')
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
        owner:users!stacks_owner_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    if (isPublic !== null) {
      query = query.eq('is_public', isPublic === 'true');
    } else {
      // If not filtering by public, only show public stacks to non-owners
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || (ownerId && ownerId !== user.id)) {
        query = query.eq('is_public', true).eq('is_hidden', false);
      }
    }

    const { data: stacks, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ stacks: stacks || [] });
  } catch (error: any) {
    console.error('Error in GET /api/stacks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

