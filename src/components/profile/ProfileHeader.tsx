'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { useFollow } from '@/hooks/useFollow';
import { ProfilePictureEditor } from './ProfilePictureEditor';
import { EditProfileModal } from './EditProfileModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/contexts/ToastContext';
import { useState } from 'react';

interface ProfileHeaderProps {
  profile: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    stats?: {
      collections_created: number;
      collections_saved: number;
      total_upvotes: number;
      total_views: number;
      followers?: number;
      following?: number;
    };
  };
  isOwnProfile?: boolean;
}

export function ProfileHeader({ profile, isOwnProfile = false }: ProfileHeaderProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const stats = profile.stats || {
    collections_created: 0,
    collections_saved: 0,
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

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    showSuccess('Logged out successfully');
    // Redirect to home page which will show landing page for signed out users
    window.location.href = '/';
  };

  const handleShareProfile = async () => {
    const profileUrl = `${window.location.origin}/profile/${profile.username}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile.display_name} (@${profile.username})`,
          text: `Check out ${profile.display_name}'s profile on Stacq`,
          url: profileUrl,
        });
      } catch (err) {
        // User cancelled or error occurred
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(profileUrl);
        showSuccess('Link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = profileUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showSuccess('Link copied to clipboard!');
      }
    }
  };

  return (
    <div className="mb-8">
      {/* Profile Picture and Info */}
      <div className="flex items-start gap-6 mb-6">
        {/* Avatar */}
        <div className="relative">
          {isOwnProfile ? (
            <ProfilePictureEditor
              currentAvatarUrl={avatarUrl}
              displayName={profile.display_name}
              userId={profile.id}
              onUpdate={(newUrl) => setAvatarUrl(newUrl || undefined)}
            />
          ) : avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={profile.display_name}
              width={120}
              height={120}
              className="rounded-full border-4 border-white shadow-card"
              unoptimized
              onError={(e) => {
                // Hide image on error
                e.currentTarget.style.display = 'none';
              }}
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
            {displayName}
          </h1>
          <p className="text-body text-gray-muted mb-4">
            @{profile.username}
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {isOwnProfile ? (
              <>
                <Button variant="outline" size="sm" onClick={handleShareProfile}>
                  Share profile
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)}>
                  Edit profile
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowLogoutConfirm(true)}
                  className="text-red-600 hover:text-red-700 hover:border-red-600"
                >
                  Sign out
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
                <Button variant="outline" size="sm" onClick={handleShareProfile}>
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
            {stats.collections_created}
          </div>
          <div className="text-small text-gray-muted">Collections</div>
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

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          currentDisplayName={displayName}
          currentUsername={profile.username}
          userId={profile.id}
          onUpdate={setDisplayName}
        />
      )}

      {/* Logout Confirmation Modal */}
      {isOwnProfile && (
        <ConfirmModal
          isOpen={showLogoutConfirm}
          onClose={() => setShowLogoutConfirm(false)}
          onConfirm={handleSignOut}
          title="Confirm Sign Out"
          message="Are you sure you want to sign out?"
          confirmText="Sign out"
          cancelText="Cancel"
          variant="default"
        />
      )}
    </div>
  );
}

