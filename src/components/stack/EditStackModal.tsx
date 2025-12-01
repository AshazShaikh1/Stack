'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface EditStackModalProps {
  isOpen: boolean;
  onClose: () => void;
  stack: {
    id: string;
    title: string;
    description?: string;
    cover_image_url?: string;
    is_public: boolean;
    is_hidden: boolean;
    tags?: Array<{ id: string; name: string }>;
  };
}

export function EditStackModal({ isOpen, onClose, stack }: EditStackModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState(stack.title);
  const [description, setDescription] = useState(stack.description || '');
  const [tags, setTags] = useState(stack.tags?.map(t => t.name).join(', ') || '');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'unlisted'>(
    stack.is_hidden ? 'unlisted' : stack.is_public ? 'public' : 'private'
  );
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(stack.cover_image_url || null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when modal opens with new stack data
  useEffect(() => {
    if (isOpen) {
      setTitle(stack.title);
      setDescription(stack.description || '');
      setTags(stack.tags?.map(t => t.name).join(', ') || '');
      setVisibility(stack.is_hidden ? 'unlisted' : stack.is_public ? 'public' : 'private');
      setCoverImage(null);
      setCoverImagePreview(stack.cover_image_url || null);
      setError('');
      setIsLoading(false);
    }
  }, [isOpen, stack]);

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
        setError('You must be logged in to edit a stack');
        setIsLoading(false);
        return;
      }

      // Generate slug from title
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Upload cover image if provided
      let coverImageUrl = stack.cover_image_url;
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

      // Update stack
      const { error: stackError } = await supabase
        .from('stacks')
        .update({
          title,
          description: description || null,
          slug,
          is_public: visibility === 'public',
          is_hidden: visibility === 'unlisted',
          cover_image_url: coverImageUrl,
        })
        .eq('id', stack.id)
        .eq('owner_id', user.id);

      if (stackError) {
        setError(stackError.message || 'Failed to update stack');
        setIsLoading(false);
        return;
      }

      // Handle tags - remove old tags and add new ones
      if (tags.trim()) {
        // Delete existing tags
        await supabase
          .from('stack_tags')
          .delete()
          .eq('stack_id', stack.id);

        // Add new tags
        const tagNames = tags
          .split(',')
          .map(t => t.trim().toLowerCase())
          .filter(t => t.length > 0)
          .slice(0, 10); // Limit to 10 tags

        for (const tagName of tagNames) {
          // Find or create tag
          let { data: tag } = await supabase
            .from('tags')
            .select('id')
            .eq('name', tagName)
            .single();

          if (!tag) {
            const { data: newTag } = await supabase
              .from('tags')
              .insert({ name: tagName })
              .select()
              .single();
            tag = newTag;
          }

          if (tag) {
            await supabase.from('stack_tags').insert({
              stack_id: stack.id,
              tag_id: tag.id,
            });
          }
        }
      } else {
        // Remove all tags if tags field is empty
        await supabase
          .from('stack_tags')
          .delete()
          .eq('stack_id', stack.id);
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Stack" size="md">
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
          placeholder="My Awesome Stack"
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
            placeholder="Describe what this stack is about..."
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
                <div className="text-small text-gray-muted">Anyone can view and discover this stack</div>
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
                <div className="text-small text-gray-muted">Only you can view this stack</div>
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
    </Modal>
  );
}

