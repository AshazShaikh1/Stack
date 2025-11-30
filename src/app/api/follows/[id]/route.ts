import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { createServiceClient } from '@/lib/supabase/api-service';

/**
 * DELETE /api/follows/[id]
 * Unfollow a user (id is the following_id)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: following_id } = await params;
    const supabase = await createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Delete follow relationship
    const serviceClient = createServiceClient();
    const { error: deleteError } = await serviceClient
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', following_id);

    if (deleteError) {
      console.error('Error deleting follow:', deleteError);
      
      // If table doesn't exist, provide helpful error
      if (deleteError.code === 'PGRST205') {
        return NextResponse.json(
          { 
            error: 'Follow system not set up. Please run the migration in Supabase SQL Editor.',
            details: 'Migration file: supabase/migrations/017_follows_table.sql'
          },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to unfollow user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error in unfollow route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

