'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { trackEvent } from '@/lib/analytics';

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
  targetType: 'stack' | 'card' | 'collection';
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

      // Optimistically add the new comment to the list
      if (data.comment) {
        const newComment = data.comment;
        if (parentId) {
          // Add as reply to parent comment
          const addReplyToComment = (comments: Comment[]): Comment[] => {
            return comments.map(comment => {
              if (comment.id === parentId) {
                return {
                  ...comment,
                  replies: [...(comment.replies || []), newComment],
                };
              }
              if (comment.replies && comment.replies.length > 0) {
                return {
                  ...comment,
                  replies: addReplyToComment(comment.replies),
                };
              }
              return comment;
            });
          };
          setComments(addReplyToComment(comments));
        } else {
          // Add as top-level comment
          setComments([...comments, newComment]);
        }
      }

      // Don't refetch - optimistic update is sufficient
      // The server already returns the correct comment data

      // Track analytics
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && data.comment) {
        trackEvent.comment(user.id, targetType as any, targetId, data.comment.id);
      }
      
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
    refreshComments: fetchComments,
  };
}

