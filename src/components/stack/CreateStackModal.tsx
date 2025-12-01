'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface CreateStackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateStackModal({ isOpen, onClose }: CreateStackModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'unlisted'>('public');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
        setError('You must be logged in to create a stack');
        setIsLoading(false);
        return;
      }

      // Generate slug from title
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Upload cover image if provided
      let coverImageUrl = null;
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

      // Create stack
      const { data: stack, error: stackError } = await supabase
        .from('stacks')
        .insert({
          title,
          description: description || null,
          slug,
          is_public: visibility === 'public',
          is_hidden: visibility === 'unlisted',
          cover_image_url: coverImageUrl,
          owner_id: user.id,
        })
        .select()
        .single();

      if (stackError) {
        setError(stackError.message || 'Failed to create stack');
        setIsLoading(false);
        return;
      }

      // Handle tags
      if (tags.trim()) {
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
      }

      // Reset form and close
      setTitle('');
      setDescription('');
      setTags('');
      setCoverImage(null);
      setCoverImagePreview(null);
      onClose();
      router.push(`/stack/${stack.slug || stack.id}`);
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Stack" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cover Image Preview */}
        {coverImagePreview && (
          <div className="relative w-full h-48 rounded-input overflow-hidden mb-4">
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
            className="w-full px-4 py-3 rounded-input border border-gray-light text-body text-jet-dark placeholder:text-gray-muted focus:outline-none focus:ring-2 focus:ring-jet focus:border-transparent disabled:bg-gray-light disabled:cursor-not-allowed resize-none"
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
          <div className="p-3 bg-red-50 border border-red-200 rounded-input text-small text-red-600">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
          >
            Create Stack
          </Button>
        </div>
      </form>
    </Modal>
  );
}

