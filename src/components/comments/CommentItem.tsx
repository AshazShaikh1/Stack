'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CommentForm } from './CommentForm';
import { ReportButton } from '@/components/report/ReportButton';
import { Dropdown } from '@/components/ui/Dropdown';
import { EditCommentModal } from './EditCommentModal';
import { useComments } from '@/hooks/useComments';
import { createClient } from '@/lib/supabase/client';

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
  stackOwnerId?: string;
  onCommentUpdate?: () => void;
}

const MAX_DEPTH = 4;

export function CommentItem({ comment, targetType, targetId, depth, stackOwnerId, onCommentUpdate }: CommentItemProps) {
  const router = useRouter();
  const [isReplying, setIsReplying] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [localComment, setLocalComment] = useState(comment);
  const { addComment, refreshComments } = useComments({ targetType, targetId });
  const canReply = depth < MAX_DEPTH;

  // Update local comment when prop changes
  useEffect(() => {
    setLocalComment(comment);
  }, [comment]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  // User can edit/delete if they are the comment author or stack owner
  const canEdit = user?.id === localComment.user_id;
  const canDelete = user?.id === localComment.user_id || (stackOwnerId && user?.id === stackOwnerId);

  const handleReply = async (content: string) => {
    try {
      await addComment(content, comment.id);
      setIsReplying(false);
    } catch (error) {
      console.error('Error replying to comment:', error);
    }
  };

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (content: string) => {
    try {
      const response = await fetch(`/api/comments/${localComment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update comment');
      }

      const data = await response.json();
      
      // Update local comment immediately
      setLocalComment({
        ...localComment,
        content: data.comment.content,
        updated_at: data.comment.updated_at,
      });

      // Refresh comments to ensure consistency
      if (onCommentUpdate) {
        onCommentUpdate();
      } else {
        await refreshComments();
      }
      
      setIsEditModalOpen(false);
    } catch (error: any) {
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete this comment? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const stackId = targetType === 'stack' ? targetId : undefined;
      const url = stackId 
        ? `/api/comments/${localComment.id}?stack_id=${stackId}`
        : `/api/comments/${localComment.id}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete comment');
      }

      // Refresh comments to remove deleted comment
      if (onCommentUpdate) {
        onCommentUpdate();
      } else {
        await refreshComments();
      }
    } catch (error: any) {
      alert(error.message || 'Failed to delete comment');
      setIsDeleting(false);
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
        {localComment.user.avatar_url ? (
          <Image
            src={localComment.user.avatar_url}
            alt={localComment.user.display_name}
            width={32}
            height={32}
            className="rounded-full flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-jet/20 flex items-center justify-center text-xs font-semibold text-jet flex-shrink-0">
            {localComment.user.display_name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/profile/${localComment.user.username}`}
              className="text-body font-semibold text-jet-dark hover:text-jet"
            >
              {localComment.user.display_name}
            </Link>
            <span className="text-small text-gray-muted">
              @{localComment.user.username}
            </span>
            <span className="text-small text-gray-muted">·</span>
            <span className="text-small text-gray-muted">
              {formatDate(localComment.created_at)}
            </span>
            {localComment.updated_at && localComment.updated_at !== localComment.created_at && (
              <>
                <span className="text-small text-gray-muted">·</span>
                <span className="text-small text-gray-muted italic">edited</span>
              </>
            )}
            {/* Dropdown Menu */}
            {(canEdit || canDelete) && (
              <div className="ml-auto">
                <Dropdown
                  items={[
                    ...(canEdit ? [{
                      label: 'Edit',
                      onClick: handleEdit,
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      ),
                    }] : []),
                    {
                      label: 'Delete',
                      onClick: handleDelete,
                      variant: 'danger' as const,
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      ),
                    },
                  ]}
                />
              </div>
            )}
          </div>

          <p className="text-body text-jet-dark mb-2 whitespace-pre-wrap">
            {localComment.content}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-2">
            {canReply && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="text-small text-gray-muted hover:text-jet transition-colors"
              >
                {isReplying ? 'Cancel' : 'Reply'}
              </button>
            )}
            <ReportButton
              targetType="comment"
              targetId={comment.id}
              variant="ghost"
              size="sm"
            />
          </div>

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
          {localComment.replies && localComment.replies.length > 0 && (
            <div className="mt-4 space-y-4">
              {localComment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  targetType={targetType}
                  targetId={targetId}
                  depth={depth + 1}
                  stackOwnerId={stackOwnerId}
                  onCommentUpdate={onCommentUpdate}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <EditCommentModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          comment={{
            id: localComment.id,
            content: localComment.content,
          }}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}

