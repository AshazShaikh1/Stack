'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BecomeStackerModal } from '@/components/auth/BecomeStackerModal';

interface EditCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: {
    id: string;
    title: string;
    description?: string;
    cover_image_url?: string;
    is_public: boolean;
    is_hidden: boolean;
    tags?: Array<{ id: string; name: string }>;
  };
}

export function EditCollectionModal({ isOpen, onClose, collection }: EditCollectionModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState(collection.title);
  const [description, setDescription] = useState(collection.description || '');
  const [tags, setTags] = useState(collection.tags?.map(t => t.name).join(', ') || '');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'unlisted'>(
    collection.is_hidden ? 'unlisted' : collection.is_public ? 'public' : 'private'
  );
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(collection.cover_image_url || null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBecomeStacker, setShowBecomeStacker] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [pendingVisibility, setPendingVisibility] = useState<'public' | 'private' | 'unlisted' | null>(null);

  // Reset form when modal opens with new collection data
  useEffect(() => {
    if (isOpen) {
      setTitle(collection.title);
      setDescription(collection.description || '');
      setTags(collection.tags?.map(t => t.name).join(', ') || '');
      setVisibility(collection.is_hidden ? 'unlisted' : collection.is_public ? 'public' : 'private');
      setCoverImage(null);
      setCoverImagePreview(collection.cover_image_url || null);
      setError('');
      setIsLoading(false);
      setShowBecomeStacker(false);
      setPendingVisibility(null);
      
      // Fetch user role
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
              setUserRole(data?.role || 'user');
            });
        }
      });
    }
  }, [isOpen, collection]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
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
        setError('You must be logged in to edit a collection');
        setIsLoading(false);
        return;
      }

      // Generate slug from title
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Upload cover image if provided
      let coverImageUrl = collection.cover_image_url;
      if (coverImage) {
        const fileExt = coverImage.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('cover-images')
          .upload(fileName, coverImage);

        if (uploadError) {
          setError('Failed to upload cover image');
          setIsLoading(false);
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('cover-images')
          .getPublicUrl(fileName);
        coverImageUrl = publicUrl;
      }

      // Check if user is trying to publish and is not a stacqer
      if (visibility === 'public' && userRole !== 'stacker' && userRole !== 'admin') {
        setPendingVisibility(visibility);
        setShowBecomeStacker(true);
        setIsLoading(false);
        return;
      }

      // Update collection via API (which enforces stacqer check)
      const response = await fetch(`/api/collections/${collection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          slug,
          is_public: visibility === 'public',
          is_hidden: visibility === 'unlisted',
          cover_image_url: coverImageUrl,
        }),
      });

      const collectionData = await response.json();

      if (!response.ok) {
        if (response.status === 403 && collectionData.become_stacker_required) {
          setPendingVisibility(visibility);
          setShowBecomeStacker(true);
          setIsLoading(false);
          return;
        }
        setError(collectionData.error || 'Failed to update collection');
        setIsLoading(false);
        return;
      }

      // Tags are handled separately if needed - for now, API handles basic update
      // You may need to add a separate API call for tags if the PATCH endpoint doesn't handle them

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
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Collection" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cover Image Preview */}
        {coverImagePreview && (
          <div className="relative w-full h-48 rounded-lg overflow-hidden mb-4">
            <img
              src={coverImagePreview}
              alt="Cover preview"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => {
                setCoverImage(null);
                setCoverImagePreview(null);
              }}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70"
            >
              ×
            </button>
          </div>
        )}

        <Input
          type="text"
          label="Title"
          placeholder="My Awesome Collection"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={isLoading}
        />

        <div>
          <label className="block text-body font-medium text-jet-dark mb-2">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this collection is about..."
            className="w-full px-4 py-3 rounded-lg border border-gray-light text-body text-jet-dark placeholder:text-gray-muted focus:outline-none focus:ring-2 focus:ring-jet focus:border-transparent disabled:bg-gray-light disabled:cursor-not-allowed resize-none"
            rows={4}
            disabled={isLoading}
          />
        </div>

        <Input
          type="text"
          label="Tags (comma-separated)"
          placeholder="design, inspiration, tools"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          helperText="Separate tags with commas (max 10)"
          disabled={isLoading}
        />

        <div>
          <label className="block text-body font-medium text-jet-dark mb-2">
            Visibility
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={visibility === 'public'}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-4 h-4 text-jet"
                disabled={isLoading}
              />
              <div>
                <div className="text-body font-medium text-jet-dark">Public</div>
                <div className="text-small text-gray-muted">Anyone can view and discover this collection</div>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="private"
                checked={visibility === 'private'}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-4 h-4 text-jet"
                disabled={isLoading}
              />
              <div>
                <div className="text-body font-medium text-jet-dark">Private</div>
                <div className="text-small text-gray-muted">Only you can view this collection</div>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="unlisted"
                checked={visibility === 'unlisted'}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-4 h-4 text-jet"
                disabled={isLoading}
              />
              <div>
                <div className="text-body font-medium text-jet-dark">Unlisted</div>
                <div className="text-small text-gray-muted">Only people with the link can view</div>
              </div>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-body font-medium text-jet-dark mb-2">
            Cover Image (optional)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full text-small text-gray-muted file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-small file:font-medium file:bg-jet file:text-white hover:file:opacity-90 cursor-pointer"
            disabled={isLoading}
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

      {/* Become Stacker Modal */}
      <BecomeStackerModal
        isOpen={showBecomeStacker}
        onClose={() => {
          setShowBecomeStacker(false);
          // If user declines, revert visibility change
          if (pendingVisibility === 'public') {
            setVisibility(collection.is_hidden ? 'unlisted' : collection.is_public ? 'public' : 'private');
          }
          setPendingVisibility(null);
        }}
        onSuccess={async () => {
          // User became stacqer, update role and retry update
          setUserRole('stacker');
          setShowBecomeStacker(false);
          
          // Wait a bit for session to refresh, then retry
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Retry the submit
          const fakeEvent = {
            preventDefault: () => {},
          } as React.FormEvent;
          await handleSubmit(fakeEvent);
        }}
        requiredFields={['display_name', 'short_bio']}
      />
    </Modal>
  );
}

