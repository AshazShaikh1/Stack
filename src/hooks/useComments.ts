'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Comment {
  id: string;
  user_id: string;
  target_type: string;
  target_id: string;
  parent_id: string | null;
  content: string;
  deleted: boolean;
  created_at: string;
  updated_at: string | null;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  replies?: Comment[];
}

interface UseCommentsOptions {
  targetType: 'stack' | 'card';
  targetId: string;
}

export function useComments({ targetType, targetId }: UseCommentsOptions) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/comments?target_type=${targetType}&target_id=${targetId}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch comments');
      }

      setComments(data.comments || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    fetchComments();
  }, [targetType, targetId, fetchComments]);

  const addComment = async (content: string, parentId?: string) => {
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          parent_id: parentId || null,
          content,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add comment');
      }

      // Refetch comments to get the new one
      await fetchComments();
      return data.comment;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  return {
    comments,
    isLoading,
    error,
    addComment,
    refetch: fetchComments,
  };
}

