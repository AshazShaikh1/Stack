'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import { Link2, Image as ImageIcon, FileText, Upload } from 'lucide-react';
import Image from "next/image";

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  stackId?: string; // Legacy support
  collectionId?: string;
}

type CardType = 'link' | 'image' | 'doc' | null;

export function AddCardModal({ isOpen, onClose, stackId, collectionId }: AddCardModalProps) {
  const id = collectionId || stackId;
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [cardType, setCardType] = useState<CardType>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  if (!id) {
    console.error('AddCardModal: Either collectionId or stackId must be provided');
    return null;
  }

  const handleUrlChange = async (newUrl: string) => {
    setUrl(newUrl);
    
    if (!newUrl.trim()) {
      setTitle('');
      setDescription('');
      setThumbnailUrl('');
      return;
    }

    // Basic URL validation
    try {
      new URL(newUrl);
    } catch {
      return; // Invalid URL, don't fetch
    }

    setIsFetchingMetadata(true);
    setError('');

    try {
      // Call API to fetch metadata
      const response = await fetch('/api/cards/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl }),
      });

      if (response.ok) {
        const data = await response.json();
        setTitle(data.title || '');
        setDescription(data.description || '');
        setThumbnailUrl(data.thumbnail_url || '');
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
      // Continue anyway - user can fill manually
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be logged in to add cards');
        setIsLoading(false);
        return;
      }

      // Create or find card
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title: title || undefined,
          description: description || undefined,
          thumbnail_url: thumbnailUrl || undefined,
          collection_id: collectionId,
          stack_id: stackId, // Legacy support
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add card');
        setIsLoading(false);
        return;
      }

      // Reset form and close
      setUrl('');
      setTitle('');
      setDescription('');
      setThumbnailUrl('');
      setCardType(null);
      showSuccess('Card added successfully!');
      onClose();
      router.refresh();
    } catch (err: any) {
      setError('An unexpected error occurred');
      showError(err.message || 'Failed to add card');
      setIsLoading(false);
    }
  };

  // Reset card type when modal closes
  const handleClose = () => {
    setCardType(null);
    setUrl('');
    setTitle('');
    setDescription('');
    setThumbnailUrl('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Card" size="md">
      {!cardType ? (
        // Card Type Selection
        <div className="space-y-4">
          <p className="text-body text-gray-muted mb-4">Choose the type of card you want to add:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setCardType('link')}
              className="p-6 rounded-lg border-2 border-gray-light hover:border-emerald transition-all duration-200 text-left group"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-lg bg-emerald/10 flex items-center justify-center mb-3 group-hover:bg-emerald/20 transition-colors">
                  <Link2 className="w-6 h-6 text-emerald" />
                </div>
                <h3 className="font-semibold text-jet-dark mb-1">Link</h3>
                <p className="text-sm text-gray-muted">Add a web link</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setCardType('image')}
              className="p-6 rounded-lg border-2 border-gray-light hover:border-emerald transition-all duration-200 text-left group"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-lg bg-emerald/10 flex items-center justify-center mb-3 group-hover:bg-emerald/20 transition-colors">
                  <ImageIcon className="w-6 h-6 text-emerald" />
                </div>
                <h3 className="font-semibold text-jet-dark mb-1">Image</h3>
                <p className="text-sm text-gray-muted">Add an image</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setCardType('doc')}
              className="p-6 rounded-lg border-2 border-gray-light hover:border-emerald transition-all duration-200 text-left group"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-lg bg-emerald/10 flex items-center justify-center mb-3 group-hover:bg-emerald/20 transition-colors">
                  <FileText className="w-6 h-6 text-emerald" />
                </div>
                <h3 className="font-semibold text-jet-dark mb-1">Document</h3>
                <p className="text-sm text-gray-muted">Add a document</p>
              </div>
            </button>
          </div>
          <div className="flex justify-end pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card Type Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {cardType === 'link' && <Link2 className="w-5 h-5 text-emerald" />}
              {cardType === 'image' && <ImageIcon className="w-5 h-5 text-emerald" />}
              {cardType === 'doc' && <FileText className="w-5 h-5 text-emerald" />}
              <span className="font-semibold text-jet-dark capitalize">{cardType}</span>
            </div>
            <button
              type="button"
              onClick={() => setCardType(null)}
              className="text-sm text-gray-muted hover:text-jet-dark"
            >
              Change type
            </button>
          </div>

          {/* URL Input */}
          <Input
            type={cardType === 'image' ? 'url' : cardType === 'doc' ? 'url' : 'url'}
            label={cardType === 'image' ? 'Image URL' : cardType === 'doc' ? 'Document URL' : 'URL'}
            placeholder={cardType === 'image' ? 'https://example.com/image.jpg' : cardType === 'doc' ? 'https://example.com/document.pdf' : 'https://example.com'}
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            required
            disabled={isLoading}
          />

        {/* Loading State */}
        {isFetchingMetadata && (
          <div className="flex items-center gap-2 text-small text-gray-muted">
            <div className="w-4 h-4 border-2 border-jet border-t-transparent rounded-full animate-spin" />
            Fetching metadata...
          </div>
        )}

        {/* Thumbnail Preview */}
        {thumbnailUrl && (
          <div className="relative w-full h-48 rounded-input overflow-hidden bg-gray-light">
            <Image
              src={thumbnailUrl}
              alt="Thumbnail preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide image on error
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Title */}
        <Input
          type="text"
          label="Title"
          placeholder="Card title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isLoading}
        />

        {/* Description */}
        <div>
          <label className="block text-body font-medium text-jet-dark mb-2">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Card description"
            className="w-full px-4 py-3 rounded-input border border-gray-light text-body text-jet-dark placeholder:text-gray-muted focus:outline-none focus:ring-2 focus:ring-jet focus:border-transparent disabled:bg-gray-light disabled:cursor-not-allowed resize-none"
            rows={3}
            disabled={isLoading}
          />
        </div>

        {/* Thumbnail URL Override */}
        <Input
          type="url"
          label="Thumbnail URL (optional)"
          placeholder="https://example.com/image.jpg"
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
          helperText="Override the auto-detected thumbnail"
          disabled={isLoading}
        />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-input text-small text-red-600">
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
            Add Card
          </Button>
        </div>
      </form>
      )}
    </Modal>
  );
}

