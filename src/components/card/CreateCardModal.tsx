'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { CreateStackModal } from '@/components/stack/CreateStackModal';
import { CardTypeSelector } from './CardTypeSelector';
import { CardDetailsStep } from './CardDetailsStep';
import { StackSelector } from './StackSelector';
import { trackEvent } from '@/lib/analytics';
import type { CardType, FileData } from '@/types';

interface CreateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUrl?: string;
  initialFileData?: FileData;
}

type Step = 'type' | 'details' | 'stack';

export function CreateCardModal({ isOpen, onClose, initialUrl, initialFileData }: CreateCardModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('type');
  const [cardType, setCardType] = useState<CardType | null>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [docsFile, setDocsFile] = useState<File | null>(null);
  const [stacks, setStacks] = useState<any[]>([]);
  const [selectedStackId, setSelectedStackId] = useState<string>('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isDraggingDocs, setIsDraggingDocs] = useState(false);
  const [isCreateStackModalOpen, setIsCreateStackModalOpen] = useState(false);

  // Handle initial URL from extension
  useEffect(() => {
    if (isOpen && initialUrl) {
      setUrl(initialUrl);
      setCardType('link');
      setStep('details');
      fetchMetadata(initialUrl);
    }
  }, [isOpen, initialUrl]);

  // Handle initial file data from extension
  useEffect(() => {
    if (isOpen && initialFileData) {
      setCardType(initialFileData.cardType);
      setStep('details');
      
      if (initialFileData.imageUrl) {
        setImageUrl(initialFileData.imageUrl);
        setImagePreview(initialFileData.imageUrl);
      } else if (initialFileData.data) {
        const dataUrl = initialFileData.data;
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], initialFileData!.name, { type: initialFileData!.type });
            if (initialFileData.cardType === 'image') {
              setImageFile(file);
              setImagePreview(dataUrl);
            } else {
              setDocsFile(file);
            }
          })
          .catch(err => console.error('Error converting file:', err));
      }

      if (initialFileData.title) setTitle(initialFileData.title);
      if (initialFileData.description) setDescription(initialFileData.description);
    }
  }, [isOpen, initialFileData]);

  // Fetch user's stacks when modal opens
  useEffect(() => {
    if (isOpen && step === 'stack') {
      fetchStacks();
    }
  }, [isOpen, step]);

  // Refresh stacks when create stack modal closes
  useEffect(() => {
    if (!isCreateStackModalOpen && step === 'stack') {
      fetchStacks();
    }
  }, [isCreateStackModalOpen, step]);

  const fetchMetadata = async (urlToFetch: string) => {
    try {
      new URL(urlToFetch);
    } catch {
      return;
    }

    setIsFetchingMetadata(true);
    try {
      const response = await fetch('/api/cards/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToFetch }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const fetchStacks = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data: userStacks, error } = await supabase
        .from('stacks')
        .select('id, title, description, cover_image_url')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching stacks:', error);
      } else {
        setStacks(userStacks || []);
      }
    } catch (err) {
      console.error('Error fetching stacks:', err);
    }
  };

  const handleCardTypeSelect = (type: CardType) => {
    setCardType(type);
    setStep('details');
    setIsDraggingImage(false);
    setIsDraggingDocs(false);
  };

  const handleFileSelect = (file: File, type: 'image' | 'docs') => {
    if (type === 'image') {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedTypes.includes(fileExt)) {
        setError('Please select a valid document file (PDF, DOC, DOCX, or TXT)');
        return;
      }
      setDocsFile(file);
    }
    setError('');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file, 'image');
  };

  const handleDocsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file, 'docs');
  };

  const handleDragOver = (e: React.DragEvent, type: 'image' | 'docs') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'image') setIsDraggingImage(true);
    else setIsDraggingDocs(true);
  };

  const handleDragLeave = (e: React.DragEvent, type: 'image' | 'docs') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'image') setIsDraggingImage(false);
    else setIsDraggingDocs(false);
  };

  const handleDrop = (e: React.DragEvent, type: 'image' | 'docs') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'image') setIsDraggingImage(false);
    else setIsDraggingDocs(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file, type);
  };

  const handleUrlChange = async (newUrl: string) => {
    setUrl(newUrl);
    
    if (!newUrl.trim()) {
      setTitle('');
      setDescription('');
      return;
    }

    await fetchMetadata(newUrl);
  };

  const handleDetailsNext = () => {
    if (cardType === 'link' && !url.trim()) {
      setError('Please enter a URL');
      return;
    }
    if (cardType === 'image' && !imageFile && !imageUrl) {
      setError('Please select an image or enter an image URL');
      return;
    }
    if (cardType === 'docs' && !docsFile) {
      setError('Please select a document');
      return;
    }
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setError('');
    // Allow skipping stack selection - user can create standalone card
    setStep('stack');
  };

  const handleSubmit = async () => {
    // Stack is optional - allow standalone cards
    setIsLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be logged in to add cards');
        setIsLoading(false);
        return;
      }

      let cardUrl = url;
      let thumbnailUrl = '';

      // Handle image upload or URL
      if (cardType === 'image') {
        if (imageFile) {
          const fileExt = imageFile.name.split('.').pop();
          const fileName = `cards/${user.id}/${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('thumbnails')
            .upload(fileName, imageFile);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('thumbnails')
              .getPublicUrl(fileName);
            cardUrl = publicUrl;
            thumbnailUrl = publicUrl;
          }
        } else if (imageUrl) {
          cardUrl = imageUrl;
          thumbnailUrl = imageUrl;
        }
      }

      // Handle docs upload
      if (cardType === 'docs' && docsFile) {
        const fileExt = docsFile.name.split('.').pop();
        const fileName = `docs/${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('thumbnails')
          .upload(fileName, docsFile);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('thumbnails')
            .getPublicUrl(fileName);
          cardUrl = publicUrl;
        }
      }

      // Determine source
      const isFromExtension = !!(initialUrl || initialFileData);
      const cardSource = isFromExtension 
        ? 'extension' 
        : (selectedStackId ? 'stack' : 'manual');

      // Create card (standalone or with stack)
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: cardUrl,
          title: title.trim(),
          description: description.trim() || undefined,
          thumbnail_url: thumbnailUrl || undefined,
          stack_id: selectedStackId || undefined,
          is_public: true, // Standalone cards are public by default
          source: cardSource,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add card');
        setIsLoading(false);
        return;
      }

      const cardData = await response.json();
      
      // Track analytics
      if (cardData.card) {
        // Check if this is from extension (has initialUrl or initialFileData)
        const isFromExtension = !!(initialUrl || initialFileData);
        if (isFromExtension) {
          trackEvent.extensionSave(user.id, cardData.card.id, selectedStackId || '', cardType || 'link');
        } else {
          trackEvent.addCard(user.id, cardData.card.id, selectedStackId || '', cardType || 'link');
        }
      }

      handleClose();
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('type');
    setCardType(null);
    setUrl('');
    setTitle('');
    setDescription('');
    setImageFile(null);
    setImagePreview(null);
    setImageUrl('');
    setDocsFile(null);
    setSelectedStackId('');
    setError('');
    setIsLoading(false);
    setIsDraggingImage(false);
    setIsDraggingDocs(false);
    onClose();
  };

  const handleBack = () => {
    if (step === 'stack') {
      setStep('details');
    } else if (step === 'details') {
      setStep('type');
      setCardType(null);
    }
    setError('');
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <div className="relative overflow-hidden">
        {/* Step 1: Card Type Selection */}
        <div
          className={`transition-transform duration-300 ease-in-out ${
            step === 'type' ? 'translate-x-0' : '-translate-x-full absolute inset-0'
          }`}
        >
          <CardTypeSelector onSelect={handleCardTypeSelect} />
        </div>

        {/* Step 2: Card Details */}
        <div
          className={`transition-transform duration-300 ease-in-out ${
            step === 'details' ? 'translate-x-0' : step === 'type' ? 'translate-x-full absolute inset-0' : '-translate-x-full absolute inset-0'
          }`}
        >
          {cardType && (
            <CardDetailsStep
              cardType={cardType}
              url={url}
              onUrlChange={handleUrlChange}
              title={title}
              onTitleChange={setTitle}
              description={description}
              onDescriptionChange={setDescription}
              imageFile={imageFile}
              imagePreview={imagePreview}
              imageUrl={imageUrl}
              onImageUrlChange={setImageUrl}
              isDraggingImage={isDraggingImage}
              onImageDragOver={(e) => handleDragOver(e, 'image')}
              onImageDragLeave={(e) => handleDragLeave(e, 'image')}
              onImageDrop={(e) => handleDrop(e, 'image')}
              onImageChange={handleImageChange}
              docsFile={docsFile}
              isDraggingDocs={isDraggingDocs}
              onDocsDragOver={(e) => handleDragOver(e, 'docs')}
              onDocsDragLeave={(e) => handleDragLeave(e, 'docs')}
              onDocsDrop={(e) => handleDrop(e, 'docs')}
              onDocsChange={handleDocsChange}
              isFetchingMetadata={isFetchingMetadata}
              error={error}
              isLoading={isLoading}
              onBack={handleBack}
              onNext={handleDetailsNext}
            />
          )}
        </div>

        {/* Step 3: Stack Selection */}
        <div
          className={`transition-transform duration-300 ease-in-out ${
            step === 'stack' ? 'translate-x-0' : 'translate-x-full absolute inset-0'
          }`}
        >
          <StackSelector
            stacks={stacks}
            selectedStackId={selectedStackId}
            onSelect={setSelectedStackId}
            onCreateNew={() => setIsCreateStackModalOpen(true)}
            onBack={handleBack}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            error={error}
          />
        </div>
      </div>

      {/* Create Stack Modal */}
      <CreateStackModal
        isOpen={isCreateStackModalOpen}
        onClose={() => setIsCreateStackModalOpen(false)}
        fromCardCreation={true}
        onStackCreated={(stackId) => {
          setSelectedStackId(stackId);
          setIsCreateStackModalOpen(false);
          setTimeout(() => {
            handleSubmit();
          }, 100);
        }}
      />
    </Modal>
  );
}
