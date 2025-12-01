import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select(`
        id,
        type,
        actor_id,
        data,
        read,
        created_at,
        actor:users!notifications_actor_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      );
    }

    return NextResponse.json({ notifications: notifications || [] });
  } catch (error) {
    console.error('Unexpected error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

