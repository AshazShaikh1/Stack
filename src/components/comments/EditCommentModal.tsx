'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface EditCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  comment: {
    id: string;
    content: string;
  };
  onSave: (content: string) => Promise<void>;
}

export function EditCommentModal({ isOpen, onClose, comment, onSave }: EditCommentModalProps) {
  const [content, setContent] = useState(comment.content);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setContent(comment.content);
      setError('');
      setIsLoading(false);
    }
  }, [isOpen, comment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!content.trim()) {
      setError('Comment cannot be empty');
      return;
    }

    setIsLoading(true);
    try {
      await onSave(content.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update comment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setIsLoading(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Comment" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-body font-medium text-jet-dark mb-2">
            Comment
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your comment..."
            className="w-full px-4 py-3 rounded-lg border border-gray-light text-body text-jet-dark placeholder:text-gray-muted focus:outline-none focus:ring-2 focus:ring-jet focus:border-transparent disabled:bg-gray-light disabled:cursor-not-allowed resize-none"
            rows={4}
            disabled={isLoading}
            required
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-small text-red-600">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

