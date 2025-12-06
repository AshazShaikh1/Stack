'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BasicInfoStep } from './BasicInfoStep';
import { OptionalDetailsStep } from './OptionalDetailsStep';
import { BecomeStackerModal } from '@/components/auth/BecomeStackerModal';
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
  const [showBecomeStacker, setShowBecomeStacker] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

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
      setShowBecomeStacker(false);
    }
  }, [isOpen]);

  // Fetch user role
  useEffect(() => {
    if (isOpen) {
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
        setError('You must be logged in to create a collection');
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

      // Check if user is trying to publish and is not a stacqer
      if (visibility === 'public' && userRole !== 'stacker' && userRole !== 'admin') {
        setShowBecomeStacker(true);
        setIsLoading(false);
        return;
      }

      // Create stack via API
      const response = await fetch('/api/stacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          tags: tags.split(',').map(t => t.trim()).filter(t => t),
          is_public: visibility === 'public',
          is_hidden: visibility === 'unlisted',
          cover_image_url: coverImageUrl,
        }),
      });

      const stackData = await response.json();

      if (!response.ok) {
        if (response.status === 403 && stackData.become_stacker_required) {
          setShowBecomeStacker(true);
          setIsLoading(false);
          return;
        }
        setError(stackData.error || 'Failed to create collection');
        setIsLoading(false);
        return;
      }

      const stack = stackData;

      // Tags are handled by the API

      // Track analytics
      if (user) {
        const { trackEvent } = await import('@/lib/analytics');
        trackEvent.createStack(user.id, stack.id, visibility === 'public');
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
    <Modal isOpen={isOpen} onClose={onClose} title="Create Collection" size="md">
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

      {/* Become Stacker Modal */}
      <BecomeStackerModal
        isOpen={showBecomeStacker}
        onClose={() => {
          setShowBecomeStacker(false);
          // If user declines, change visibility to private
          if (visibility === 'public') {
            setVisibility('private');
          }
        }}
        onSuccess={async () => {
          // User became stacqer, update role and retry collection creation
          setUserRole('stacker');
          setShowBecomeStacker(false);
          
          // Wait a bit for session to refresh, then retry
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Retry the submit by calling handleSubmit directly
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
