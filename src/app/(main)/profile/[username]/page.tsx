import { createClient } from '@/lib/supabase/server';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { FeedGrid } from '@/components/feed/FeedGrid';
import { notFound } from 'next/navigation';

interface ProfilePageProps {
  params: Promise<{
    username: string;
  }>;
  searchParams: Promise<{
    tab?: string;
  }>;
}

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const { username } = await params;
  const { tab: tabParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const tab = tabParam || 'created';

  // Get profile user
  const { data: profileUser, error: profileError } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url')
    .eq('username', username)
    .single();

  if (profileError || !profileUser) {
    notFound();
  }

  const isOwnProfile = currentUser?.id === profileUser.id;

  // Get stats
  const [createdCount, savedCount, upvotesResult, viewsResult, followerCount, followingCount] = await Promise.all([
    supabase
      .from('stacks')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', profileUser.id),
    supabase
      .from('stack_cards')
      .select('stack_id', { count: 'exact', head: true })
      .eq('added_by', profileUser.id),
    supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profileUser.id),
    supabase
      .from('stacks')
      .select('stats', { count: 'exact' })
      .eq('owner_id', profileUser.id),
    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', profileUser.id),
    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', profileUser.id),
  ]);

  const totalViews = viewsResult.data?.reduce((sum, stack) => {
    return sum + ((stack.stats as any)?.views || 0);
  }, 0) || 0;

  const profile = {
    ...profileUser,
    stats: {
      stacks_created: createdCount.count || 0,
      stacks_saved: savedCount.count || 0,
      total_upvotes: upvotesResult.count || 0,
      total_views: totalViews,
      followers: followerCount.count || 0,
      following: followingCount.count || 0,
    },
  };

  // Get stacks based on tab
  let stacksQuery = supabase
    .from('stacks')
    .select(`
      id,
      title,
      description,
      cover_image_url,
      owner_id,
      stats,
      owner:users!stacks_owner_id_fkey (
        username,
        display_name,
        avatar_url
      )
    `);

  if (tab === 'created') {
    stacksQuery = stacksQuery.eq('owner_id', profileUser.id);
    if (!isOwnProfile) {
      stacksQuery = stacksQuery.eq('is_public', true).eq('is_hidden', false);
    }
  } else if (tab === 'saved') {
    // Get saved stacks (stacks that user has added cards to)
    const { data: savedStacks } = await supabase
      .from('stack_cards')
      .select('stack_id')
      .eq('added_by', profileUser.id)
      .limit(100);

    if (savedStacks && savedStacks.length > 0) {
      const stackIds = savedStacks.map(sc => sc.stack_id);
      stacksQuery = stacksQuery.in('id', stackIds);
      if (!isOwnProfile) {
        stacksQuery = stacksQuery.eq('is_public', true).eq('is_hidden', false);
      }
    } else {
      stacksQuery = stacksQuery.eq('id', '00000000-0000-0000-0000-000000000000'); // Return no results
    }
  }

  const { data: stacks, error: stacksError } = await stacksQuery
    .order('created_at', { ascending: false })
    .limit(40);

  if (stacksError) {
    console.error('Error fetching stacks:', stacksError);
  }

  return (
    <div className="container mx-auto px-page py-section">
      <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} />

      {/* Tabs */}
      <div className="border-b border-gray-light mb-6">
        <div className="flex gap-8">
          <a
            href={`/profile/${username}?tab=created`}
            className={`
              pb-4 px-1 border-b-2 transition-colors
              ${tab === 'created'
                ? 'border-jet text-jet-dark font-semibold'
                : 'border-transparent text-gray-muted hover:text-jet-dark'
              }
            `}
          >
            Created
          </a>
          <a
            href={`/profile/${username}?tab=saved`}
            className={`
              pb-4 px-1 border-b-2 transition-colors
              ${tab === 'saved'
                ? 'border-jet text-jet-dark font-semibold'
                : 'border-transparent text-gray-muted hover:text-jet-dark'
              }
            `}
          >
            Saved
          </a>
        </div>
      </div>

      {/* Stacks Grid */}
      <FeedGrid stacks={stacks || []} />
    </div>
  );
}

