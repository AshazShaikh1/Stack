import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { createServiceClient } from '@/lib/supabase/api-service';
import { trackEvent } from '@/lib/analytics';

/**
 * POST /api/users/become-stacker
 * Convert a user account to stacker role
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is already a stacker or admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, display_name, avatar_url')
      .eq('id', user.id)
      .single();

    if (userProfile?.role === 'stacker' || userProfile?.role === 'admin') {
      return NextResponse.json(
        { error: 'User is already a stacker' },
        { status: 400 }
      );
    }

    const { display_name, avatar_url, short_bio, phone } = await request.json();

    // Validate required fields
    if (!display_name || display_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Display name is required' },
        { status: 400 }
      );
    }

    if (display_name.length > 100) {
      return NextResponse.json(
        { error: 'Display name must be 100 characters or less' },
        { status: 400 }
      );
    }

    if (short_bio && short_bio.length > 500) {
      return NextResponse.json(
        { error: 'Short bio must be 500 characters or less' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    // Update user to stacker role
    const updateData: any = {
      role: 'stacker',
      display_name: display_name.trim(),
    };

    if (avatar_url) {
      updateData.avatar_url = avatar_url;
    }

    if (short_bio) {
      updateData.metadata = {
        ...(userProfile?.metadata || {}),
        short_bio: short_bio.trim(),
      };
    }

    if (phone) {
      updateData.metadata = {
        ...updateData.metadata,
        phone: phone.trim(),
      };
    }

    const { data: updatedUser, error: updateError } = await serviceClient
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    // Track analytics
    trackEvent.becomeStacker(user.id);

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'You are now a Stacker! You can publish public stacks and access creator features.',
    });
  } catch (error) {
    console.error('Error in become-stacker route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

