import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';

/**
 * GET /api/notifications/unread-count
 * Get the count of unread notifications for the current user
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

    // Count unread notifications
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) {
      console.error('Error counting unread notifications:', error);
      return NextResponse.json(
        { error: 'Failed to get unread count' },
        { status: 500 }
      );
    }

    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('Unexpected error in unread-count route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

