'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseVotesOptions {
  targetType: 'stack' | 'card';
  targetId: string;
  initialUpvotes?: number;
  initialVoted?: boolean;
}

export function useVotes({ targetType, targetId, initialUpvotes = 0, initialVoted = false }: UseVotesOptions) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [voted, setVoted] = useState(initialVoted);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVoteCount = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get vote count
    const { count } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', targetType)
      .eq('target_id', targetId);

    setUpvotes(count || 0);

    // Check if user has voted
    if (user) {
      const { data: userVote } = await supabase
        .from('votes')
        .select('id')
        .eq('user_id', user.id)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .maybeSingle();

      setVoted(!!userVote);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Fetch initial vote count
    fetchVoteCount();
  }, [targetType, targetId, fetchVoteCount]);

  const toggleVote = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to vote');
      }

      // Optimistic update
      setVoted(data.voted);
      setUpvotes(prev => data.voted ? prev + 1 : prev - 1);
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

