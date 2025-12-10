'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { trackEvent } from '@/lib/analytics';
import { useToast } from '@/contexts/ToastContext';

interface UseVotesOptions {
  targetType: 'collection' | 'card' | 'stack'; // 'stack' for legacy support
  targetId: string;
  initialUpvotes?: number;
  initialVoted?: boolean;
}

export function useVotes({ targetType, targetId, initialUpvotes = 0, initialVoted = false }: UseVotesOptions) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [voted, setVoted] = useState(initialVoted);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showError, showInfo } = useToast();

  const fetchVoteCount = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get vote count - support both 'collection' and 'stack' (legacy)
    const voteType = targetType === 'stack' ? 'collection' : targetType;
    const { count, error } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', voteType)
      .eq('target_id', targetId);

    if (error) {
      console.error('Error fetching vote count:', error);
      // Don't overwrite if there's an error - keep current value
      return;
    }

    setUpvotes(count || 0);

    // Check if user has voted
    if (user) {
      const { data: userVote } = await supabase
        .from('votes')
        .select('id')
        .eq('user_id', user.id)
        .eq('target_type', voteType)
        .eq('target_id', targetId)
        .maybeSingle();

      setVoted(!!userVote);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Only fetch if we don't have an initial value or if the ID changed
    // This prevents overwriting the initial value from the feed API
    if (initialUpvotes === 0 && upvotes === 0) {
      fetchVoteCount();
    } else if (!initialVoted) {
      // Only fetch user's vote status if we don't have initial value
      // Use fetchVoteCount which already handles user check efficiently
      fetchVoteCount();
    }
  }, [targetType, targetId, fetchVoteCount, initialUpvotes, initialVoted, upvotes]);

  const toggleVote = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      showInfo('Please sign in to upvote');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Convert 'stack' to 'collection' for API
      const apiTargetType = targetType === 'stack' ? 'collection' : targetType;
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: apiTargetType,
          target_id: targetId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          showInfo('Please sign in to upvote');
          setTimeout(() => {
            window.location.href = '/login';
          }, 1500);
          return;
        }
        if (response.status === 403) {
          // Show user-friendly error message for 403 (account age or shadowban)
          const errorMsg = data.error || 'Unable to vote. Your account may be too new or restricted.';
          showError(errorMsg);
          setError(errorMsg);
          return;
        }
        throw new Error(data.error || 'Failed to vote');
      }

      // Optimistic update
      setVoted(data.voted);
      setUpvotes(prev => data.voted ? prev + 1 : prev - 1);

      // Track analytics
      if (data.voted && user) {
        trackEvent.upvote(user.id, targetType as any, targetId);
      }
    } catch (err: any) {
      setError(err.message);
      // Revert optimistic update
      fetchVoteCount();
    } finally {
      setIsLoading(false);
    }
  };

  return {
    upvotes,
    voted,
    isLoading,
    error,
    toggleVote,
  };
}

