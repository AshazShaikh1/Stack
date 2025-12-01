import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { FeedGrid } from '@/components/feed/FeedGrid';
import { StackGridSkeleton } from '@/components/ui/Skeleton';
import { EmptySavedStacksState } from '@/components/ui/EmptyState';
import { Suspense } from 'react';

async function SavedStacks() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  // Get saved stacks
  const { data: saves, error } = await supabase
    .from('saves')
    .select(`
      id,
      created_at,
      stack:stacks!saves_stack_id_fkey (
        id,
        title,
        description,
        slug,
        cover_image_url,
        is_public,
        stats,
        owner_id,
        created_at,
        owner:users!stacks_owner_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching saved stacks:', error);
    return <EmptySavedStacksState />;
  }

  // Transform saves to stacks format
  const stacks = (saves || [])
    .map((save: any) => save.stack)
    .filter((stack: any) => stack !== null && stack.is_public); // Only show public stacks

  if (stacks.length === 0) {
    return <EmptySavedStacksState />;
  }

  return <FeedGrid stacks={stacks} />;
}

export default function SavedPage() {
  return (
    <div className="container mx-auto px-page py-section">
      <div className="mb-8">
        <h1 className="text-h1 font-bold text-jet-dark mb-2">Saved Stacks</h1>
        <p className="text-body text-gray-muted">
          All the stacks you've saved for later
        </p>
      </div>

      <Suspense fallback={<StackGridSkeleton />}>
        <SavedStacks />
      </Suspense>
    </div>
  );
}

