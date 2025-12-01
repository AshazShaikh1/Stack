import { createClient } from '@/lib/supabase/server';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { FeedGrid } from '@/components/feed/FeedGrid';
import { generateMetadata as generateSEOMetadata } from '@/lib/seo';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface ProfilePageProps {
  params: Promise<{
    username: string;
  }>;
  searchParams: Promise<{
    tab?: string;
  }>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  
  const { data: profileUser } = await supabase
    .from('users')
    .select('display_name, avatar_url')
    .eq('username', username)
    .single();
  
  if (!profileUser) {
    return generateSEOMetadata({
      title: 'Profile Not Found',
      description: 'The profile you are looking for does not exist',
    });
  }
  
  return generateSEOMetadata({
    title: `${profileUser.display_name} (@${username})`,
    description: `View ${profileUser.display_name}'s profile on Stack`,
    image: profileUser.avatar_url || undefined,
    url: `/profile/${username}`,
  });
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
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profileUser.id),
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
    // Get saved stacks from saves table
    const { data: saves } = await supabase
      .from('saves')
      .select('stack_id')
      .eq('user_id', profileUser.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (saves && saves.length > 0) {
      const stackIds = saves.map(s => s.stack_id);
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

