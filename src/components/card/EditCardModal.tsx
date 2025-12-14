'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

interface EditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: {
    id: string;
    title?: string;
    description?: string;
    thumbnail_url?: string;
    canonical_url: string;
  };
}

export function EditCardModal({ isOpen, onClose, card }: EditCardModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState(card.title || '');
  const [description, setDescription] = useState(card.description || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(card.thumbnail_url || '');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when modal opens with new card data
  useEffect(() => {
    if (isOpen) {
      setTitle(card.title || '');
      setDescription(card.description || '');
      setThumbnailUrl(card.thumbnail_url || '');
      setError('');
      setIsLoading(false);
    }
  }, [isOpen, card]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be logged in to edit a card');
        setIsLoading(false);
        return;
      }

      // Update card
      const response = await fetch(`/api/cards/${card.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim() || null,
          description: description.trim() || null,
          thumbnail_url: thumbnailUrl.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update card');
        setIsLoading(false);
        return;
      }

      // Reset and close
      setIsLoading(false);
      onClose();
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setIsLoading(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Card" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="url"
          label="URL"
          placeholder="https://example.com"
          value={card.canonical_url}
          disabled
          helperText="URL cannot be changed"
        />

        {/* Thumbnail Preview */}
        {thumbnailUrl && (
          <div className="relative w-full h-48 rounded-lg overflow-hidden mb-4">
            <Image
              src={thumbnailUrl}
              alt="Thumbnail preview"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => setThumbnailUrl('')}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70"
            >
              ×
            </button>
          </div>
        )}

        <Input
          type="text"
          label="Title"
          placeholder="Card title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isLoading}
        />

        <div>
          <label className="block text-body font-medium text-jet-dark mb-2">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Card description"
            className="w-full px-4 py-3 rounded-lg border border-gray-light text-body text-jet-dark placeholder:text-gray-muted focus:outline-none focus:ring-2 focus:ring-jet focus:border-transparent disabled:bg-gray-light disabled:cursor-not-allowed resize-none"
            rows={4}
            disabled={isLoading}
          />
        </div>

        <Input
          type="url"
          label="Thumbnail URL (optional)"
          placeholder="https://example.com/image.jpg"
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
          helperText="Override the thumbnail image"
          disabled={isLoading}
        />

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

