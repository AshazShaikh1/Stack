'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

interface CommentFormProps {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  onCancel?: () => void;
  parentId?: string;
}

export function CommentForm({
  onSubmit,
  placeholder = 'Write a comment...',
  onCancel,
}: CommentFormProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  if (!user) {
    return (
      <div className="p-4 bg-gray-light rounded-lg text-center text-gray-muted">
        <Link href="/login" className="text-jet hover:underline">
          Sign in
        </Link> to comment
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('Comment cannot be empty');
      return;
    }

    if (content.length > 5000) {
      setError('Comment must be less than 5000 characters');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(content.trim());
      setContent('');
      if (onCancel) {
        onCancel();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setError(null);
        }}
        placeholder={placeholder}
        rows={3}
        className="w-full px-4 py-3 border border-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-jet focus:border-transparent resize-none text-body"
        maxLength={5000}
      />
      
      {error && (
        <div className="text-small text-red-500">{error}</div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-small text-gray-muted">
          {content.length}/5000 characters
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting || !content.trim()}
          >
            {isSubmitting ? 'Posting...' : 'Post Comment'}
          </Button>
        </div>
      </div>
    </form>
  );
}

