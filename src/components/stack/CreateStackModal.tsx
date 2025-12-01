'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BasicInfoStep } from './BasicInfoStep';
import { OptionalDetailsStep } from './OptionalDetailsStep';
import type { StackVisibility } from '@/types';

interface CreateStackModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromCardCreation?: boolean;
  onStackCreated?: (stackId: string) => void;
}

type Step = 'basic' | 'details';

export function CreateStackModal({ isOpen, onClose, fromCardCreation = false, onStackCreated }: CreateStackModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('basic');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<StackVisibility>('public');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('basic');
      setTitle('');
      setDescription('');
      setTags('');
      setVisibility('public');
      setCoverImage(null);
      setCoverImagePreview(null);
      setError('');
      setIsLoading(false);
      setIsDragging(false);
    }
  }, [isOpen]);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    setCoverImage(file);
    setError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
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
          .slice(0, 10);

        for (const tagName of tagNames) {
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

      // Reset form state
      setTitle('');
      setDescription('');
      setTags('');
      setCoverImage(null);
      setCoverImagePreview(null);
      setIsLoading(false);
      setError('');
      
      // If called from card creation, call callback and close
      if (fromCardCreation && onStackCreated) {
        onStackCreated(stack.id);
        onClose();
        return;
      }
      
      // Otherwise, close modal and navigate
      onClose();
      router.push(`/stack/${stack.slug || stack.id}`);
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  const handleBasicNext = () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setError('');
    setStep('details');
  };

  const handleDetailsBack = () => {
    setStep('basic');
    setError('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Stack" size="md">
      <form onSubmit={handleSubmit} className="space-y-4 relative overflow-hidden">
        {/* Step 1: Basic Info */}
        <div
          className={`transition-transform duration-300 ease-in-out ${
            step === 'basic'
              ? 'translate-x-0'
              : '-translate-x-full absolute inset-0 opacity-0 pointer-events-none'
          } min-h-[450px]`}
        >
          <BasicInfoStep
            title={title}
            onTitleChange={setTitle}
            description={description}
            onDescriptionChange={setDescription}
            tags={tags}
            onTagsChange={setTags}
            error={error}
            isLoading={isLoading}
            onCancel={onClose}
            onNext={handleBasicNext}
          />
        </div>

        {/* Step 2: Optional Details */}
        <div
          className={`transition-transform duration-300 ease-in-out ${
            step === 'details'
              ? 'translate-x-0'
              : 'translate-x-full absolute inset-0 opacity-0 pointer-events-none'
          } min-h-[450px]`}
        >
          <OptionalDetailsStep
            visibility={visibility}
            onVisibilityChange={setVisibility}
            coverImage={coverImage}
            coverImagePreview={coverImagePreview}
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onImageChange={handleImageChange}
            error={error}
            isLoading={isLoading}
            onBack={handleDetailsBack}
          />
        </div>
      </form>
    </Modal>
  );
}
