'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { useFollow } from '@/hooks/useFollow';

interface ProfileHeaderProps {
  profile: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    stats?: {
      stacks_created: number;
      stacks_saved: number;
      total_upvotes: number;
      total_views: number;
      followers?: number;
      following?: number;
    };
  };
  isOwnProfile?: boolean;
}

export function ProfileHeader({ profile, isOwnProfile = false }: ProfileHeaderProps) {
  const stats = profile.stats || {
    stacks_created: 0,
    stacks_saved: 0,
    total_upvotes: 0,
    total_views: 0,
    followers: 0,
    following: 0,
  };

  const {
    isFollowing,
    followerCount,
    followingCount,
    isLoading: isFollowLoading,
    error: followError,
    toggleFollow,
  } = useFollow({
    userId: profile.id,
    initialIsFollowing: false,
    initialFollowerCount: stats.followers || 0,
    initialFollowingCount: stats.following || 0,
  });

  return (
    <div className="mb-8">
      {/* Profile Picture and Info */}
      <div className="flex items-start gap-6 mb-6">
        {/* Avatar */}
        <div className="relative">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.display_name}
              width={120}
              height={120}
              className="rounded-full border-4 border-white shadow-card"
            />
          ) : (
            <div className="w-30 h-30 rounded-full bg-gradient-to-br from-jet/20 to-gray-light border-4 border-white shadow-card flex items-center justify-center text-4xl font-bold text-jet">
              {profile.display_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Profile Info */}
        <div className="flex-1">
          <h1 className="text-h1 font-bold text-jet-dark mb-2">
            {profile.display_name}
          </h1>
          <p className="text-body text-gray-muted mb-4">
            @{profile.username}
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {isOwnProfile ? (
              <>
                <Button variant="outline" size="sm">
                  Share profile
                </Button>
                <Button variant="outline" size="sm">
                  Edit profile
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={isFollowing ? 'outline' : 'primary'}
                  size="sm"
                  onClick={toggleFollow}
                  disabled={isFollowLoading}
                >
                  {isFollowLoading ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
                </Button>
                <Button variant="outline" size="sm">
                  Share profile
                </Button>
              </>
            )}
          </div>
          {followError && (
            <p className="text-sm text-red-500 mt-2">{followError}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-8">
        <div>
          <div className="text-h2 font-bold text-jet-dark">
            {stats.stacks_created}
          </div>
          <div className="text-small text-gray-muted">Stacks</div>
        </div>
        <div>
          <div className="text-h2 font-bold text-jet-dark">
            {followerCount}
          </div>
          <div className="text-small text-gray-muted">Followers</div>
        </div>
        <div>
          <div className="text-h2 font-bold text-jet-dark">
            {followingCount}
          </div>
          <div className="text-small text-gray-muted">Following</div>
        </div>
        <div>
          <div className="text-h2 font-bold text-jet-dark">
            {stats.total_upvotes}
          </div>
          <div className="text-small text-gray-muted">Upvotes</div>
        </div>
        <div>
          <div className="text-h2 font-bold text-jet-dark">
            {stats.total_views}
          </div>
          <div className="text-small text-gray-muted">Views</div>
        </div>
      </div>
    </div>
  );
}

