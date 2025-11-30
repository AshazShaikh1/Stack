'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { CommentForm } from './CommentForm';
import { useComments } from '@/hooks/useComments';

interface Comment {
  id: string;
  user_id: string;
  content: string;
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

interface CommentItemProps {
  comment: Comment;
  targetType: 'stack' | 'card';
  targetId: string;
  depth: number;
}

const MAX_DEPTH = 4;

export function CommentItem({ comment, targetType, targetId, depth }: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const { addComment } = useComments({ targetType, targetId });
  const canReply = depth < MAX_DEPTH;

  const handleReply = async (content: string) => {
    try {
      await addComment(content, comment.id);
      setIsReplying(false);
    } catch (error) {
      console.error('Error replying to comment:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`${depth > 0 ? 'ml-8 border-l-2 border-gray-light pl-4' : ''}`}>
      <div className="flex gap-3">
        {/* Avatar */}
        {comment.user.avatar_url ? (
          <Image
            src={comment.user.avatar_url}
            alt={comment.user.display_name}
            width={32}
            height={32}
            className="rounded-full flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-jet/20 flex items-center justify-center text-xs font-semibold text-jet flex-shrink-0">
            {comment.user.display_name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/profile/${comment.user.username}`}
              className="text-body font-semibold text-jet-dark hover:text-jet"
            >
              {comment.user.display_name}
            </Link>
            <span className="text-small text-gray-muted">
              @{comment.user.username}
            </span>
            <span className="text-small text-gray-muted">·</span>
            <span className="text-small text-gray-muted">
              {formatDate(comment.created_at)}
            </span>
          </div>

          <p className="text-body text-jet-dark mb-2 whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* Actions */}
          {canReply && (
            <div className="flex items-center gap-4 mt-2">
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="text-small text-gray-muted hover:text-jet transition-colors"
              >
                {isReplying ? 'Cancel' : 'Reply'}
              </button>
            </div>
          )}

          {/* Reply Form */}
          {isReplying && canReply && (
            <div className="mt-4">
              <CommentForm
                onSubmit={handleReply}
                placeholder="Write a reply..."
                onCancel={() => setIsReplying(false)}
              />
            </div>
          )}

          {/* Nested Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-4 space-y-4">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  targetType={targetType}
                  targetId={targetId}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

