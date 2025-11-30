'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseFollowOptions {
  userId: string;
  initialIsFollowing?: boolean;
  initialFollowerCount?: number;
  initialFollowingCount?: number;
}

export function useFollow({
  userId,
  initialIsFollowing = false,
  initialFollowerCount = 0,
  initialFollowingCount = 0,
}: UseFollowOptions) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [followingCount, setFollowingCount] = useState(initialFollowingCount);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial follow status
  useEffect(() => {
    const fetchFollowStatus = async () => {
      try {
        const response = await fetch(`/api/follows/check/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setIsFollowing(data.isFollowing);
          setFollowerCount(data.followerCount);
          setFollowingCount(data.followingCount);
        }
      } catch (err) {
        console.error('Error fetching follow status:', err);
      }
    };

    fetchFollowStatus();
  }, [userId]);

  const toggleFollow = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (isFollowing) {
        // Unfollow
        const response = await fetch(`/api/follows/${userId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to unfollow');
        }

        // Optimistic update
        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
      } else {
        // Follow
        const response = await fetch('/api/follows', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ following_id: userId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to follow');
        }

        // Optimistic update
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      // Revert optimistic update
      setIsFollowing(!isFollowing);
      if (isFollowing) {
        setFollowerCount(prev => prev + 1);
      } else {
        setFollowerCount(prev => Math.max(0, prev - 1));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isFollowing,
    followerCount,
    followingCount,
    isLoading,
    error,
    toggleFollow,
  };
}

