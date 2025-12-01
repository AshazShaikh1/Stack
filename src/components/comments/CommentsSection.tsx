'use client';

import { useComments } from '@/hooks/useComments';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';

interface CommentsSectionProps {
  targetType: 'stack' | 'card';
  targetId: string;
  stackOwnerId?: string;
}

export function CommentsSection({ targetType, targetId, stackOwnerId }: CommentsSectionProps) {
  const { comments, isLoading, error, addComment, refreshComments } = useComments({
    targetType,
    targetId,
  });

  if (isLoading) {
    return (
      <div className="py-8">
        <div className="text-center text-gray-muted">Loading comments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8">
        <div className="text-center text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <h2 className="text-h2 font-bold text-jet-dark mb-6">
        Comments ({comments.length})
      </h2>

      <CommentForm onSubmit={addComment} />

      <div className="mt-8 space-y-6">
        {comments.length === 0 ? (
          <div className="text-center text-gray-muted py-8">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              targetType={targetType}
              targetId={targetId}
              depth={0}
              stackOwnerId={stackOwnerId}
              onCommentUpdate={refreshComments}
            />
          ))
        )}
      </div>
    </div>
  );
}

