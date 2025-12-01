import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/api';
import { createServiceClient } from '@/lib/supabase/api-service';

/**
 * PATCH /api/notifications/[id]
 * Mark a notification as read
 * Body: { read: boolean }
 */
export async function PATCH(
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

    const body = await request.json();
    const { read } = body;

    if (typeof read !== 'boolean') {
      return NextResponse.json(
        { error: 'read must be a boolean' },
        { status: 400 }
      );
    }

    // Check if notification exists and belongs to user
    const { data: notification, error: checkError } = await supabase
      .from('notifications')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (checkError || !notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    if (notification.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only update your own notifications' },
        { status: 403 }
      );
    }

    // Update notification using service client
    const serviceClient = createServiceClient();
    const { data: updatedNotification, error: updateError } = await serviceClient
      .from('notifications')
      .update({ read })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating notification:', updateError);
      return NextResponse.json(
        { error: 'Failed to update notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({ notification: updatedNotification });
  } catch (error: any) {
    console.error('Unexpected error updating notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

