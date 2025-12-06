import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { StackerDashboard } from '@/components/stacker/StackerDashboard';

export default async function StackerDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user is a stacqer or admin
  const { data: userProfile } = await supabase
    .from('users')
    .select('role, username, display_name, avatar_url')
    .eq('id', user.id)
    .single();

  if (userProfile?.role !== 'stacker' && userProfile?.role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-cloud">
      <StackerDashboard user={userProfile} />
    </div>
  );
}
