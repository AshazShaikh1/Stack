'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { CreateCollectionModal } from '@/components/collection/CreateCollectionModal';
import { CardTypeSelector } from './CardTypeSelector';
import { CardDetailsStep } from './CardDetailsStep';
import { OptionalDetailsStep } from '@/components/stack/OptionalDetailsStep';
import { StackSelector } from './StackSelector';
import { BecomeStackerModal } from '@/components/auth/BecomeStackerModal';
import { trackEvent } from '@/lib/analytics';
import type { CardType, FileData, StackVisibility } from '@/types';

interface CreateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUrl?: string;
  initialFileData?: FileData;
}

type Step = 'type' | 'details' | 'optional' | 'stack';

export function CreateCardModal({ isOpen, onClose, initialUrl, initialFileData }: CreateCardModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('type');
  const [cardType, setCardType] = useState<CardType | null>(null);
  
  // Details
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [docsFile, setDocsFile] = useState<File | null>(null);
  
  // Optional Details
  const [visibility, setVisibility] = useState<StackVisibility>('private');
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [isDraggingCover, setIsDraggingCover] = useState(false);

  // Collections
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [selectedStackId, setSelectedStackId] = useState<string>('');
  
  // State
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isDraggingDocs, setIsDraggingDocs] = useState(false);
  
  // Modals
  const [isCreateCollectionModalOpen, setIsCreateCollectionModalOpen] = useState(false);
  const [isBecomeStackerModalOpen, setIsBecomeStackerModalOpen] = useState(false);
  const [isStacker, setIsStacker] = useState(false);

  const titleRef = useRef<string>('');
  const descriptionRef = useRef<string>('');
  const metadataFetchUrlRef = useRef<string>('');

  useEffect(() => {
    if (isOpen) {
      checkUserRole();
    }
  }, [isOpen]);

  const checkUserRole = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      
      setIsStacker(profile?.role === 'stacker' || profile?.role === 'admin');
    }
  };

  useEffect(() => {
    if (isOpen && initialUrl) {
      setUrl(initialUrl);
      setCardType('link');
      setStep('details');
      titleRef.current = '';
      descriptionRef.current = '';
      fetchMetadata(initialUrl);
    }
  }, [isOpen, initialUrl]);

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

      if (initialFileData.title) {
        setTitle(initialFileData.title);
        titleRef.current = initialFileData.title;
      }
      if (initialFileData.description) {
        setDescription(initialFileData.description);
        descriptionRef.current = initialFileData.description;
      }
    }
  }, [isOpen, initialFileData]);

  useEffect(() => {
    if ((isOpen && step === 'stack') || (!isCreateCollectionModalOpen && step === 'stack')) {
      fetchCollections();
    }
  }, [isOpen, step, isCreateCollectionModalOpen]);

  const fetchMetadata = async (urlToFetch: string) => {
    try {
      new URL(urlToFetch);
    } catch { return; }

    metadataFetchUrlRef.current = urlToFetch;
    setIsFetchingMetadata(true);
    try {
      const response = await fetch('/api/cards/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToFetch }),
      });

      if (response.ok) {
        const data = await response.json();
        if (metadataFetchUrlRef.current === urlToFetch) {
          if (!titleRef.current.trim() && data.title) {
            setTitle(data.title);
            titleRef.current = data.title;
          }
          if (!descriptionRef.current.trim() && data.description) {
            setDescription(data.description);
            descriptionRef.current = data.description;
          }
          if (data.thumbnail_url && !coverImagePreview) {
            setCoverImagePreview(data.thumbnail_url);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const fetchCollections = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userCollections } = await supabase
      .from('collections')
      .select('id, title, description, cover_image_url')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    setCollections(userCollections || []);
  };

  const handleCardTypeSelect = (type: CardType) => {
    setCardType(type);
    setStep('details');
  };

  const handleFileSelect = (file: File, type: 'image' | 'docs') => {
    if (type === 'image') {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setDocsFile(file);
    }
    setError('');
  };

  const handleDetailsNext = async () => {
    if (cardType === 'link' && !url.trim()) {
      setError('Please enter a URL');
      return;
    }
    
    // Explicit fetch if moving forward
    if (cardType === 'link' && url.trim() && (!title.trim() || !coverImagePreview)) {
      await fetchMetadata(url);
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
    
    if (cardType === 'image' && !coverImagePreview && imagePreview) {
      setCoverImagePreview(imagePreview);
    }

    setError('');
    setStep('optional');
  };

  const handleOptionalNext = () => {
    // Check permissions if Public is selected
    if (visibility === 'public' && !isStacker) {
      setIsBecomeStackerModalOpen(true);
      return;
    }
    
    fetchCollections();
    setStep('stack');
  };

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }
    setCoverImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setError('');
  };

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCover(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const event = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleCoverImageChange(event);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be logged in');
        setIsLoading(false);
        return;
      }

      let cardUrl = url;
      let thumbnailUrl = '';

      // Upload main content
      if (cardType === 'image' && imageFile) {
        const fileName = `cards/${user.id}/${Date.now()}.${imageFile.name.split('.').pop()}`;
        const { error } = await supabase.storage.from('thumbnails').upload(fileName, imageFile);
        if (!error) {
          const { data } = supabase.storage.from('thumbnails').getPublicUrl(fileName);
          cardUrl = data.publicUrl;
          thumbnailUrl = data.publicUrl;
        }
      } else if (cardType === 'image' && imageUrl) {
        cardUrl = imageUrl;
        thumbnailUrl = imageUrl;
      } else if (cardType === 'docs' && docsFile) {
        const fileName = `docs/${user.id}/${Date.now()}.${docsFile.name.split('.').pop()}`;
        const { error } = await supabase.storage.from('thumbnails').upload(fileName, docsFile);
        if (!error) {
          const { data } = supabase.storage.from('thumbnails').getPublicUrl(fileName);
          cardUrl = data.publicUrl;
        }
      }

      // Upload Cover Image (Override)
      if (coverImageFile) {
        const fileName = `covers/${user.id}/${Date.now()}_cover.${coverImageFile.name.split('.').pop()}`;
        const { error } = await supabase.storage.from('thumbnails').upload(fileName, coverImageFile);
        if (!error) {
          const { data } = supabase.storage.from('thumbnails').getPublicUrl(fileName);
          thumbnailUrl = data.publicUrl;
        }
      } else if (cardType === 'link' && coverImagePreview && coverImagePreview.startsWith('http')) {
        thumbnailUrl = coverImagePreview;
      }

      const id = selectedCollectionId || selectedStackId;
      // If collection selected, visibility is determined by collection.
      // If standalone, we use the selected visibility (public only allowed for stackers).
      // Note: 'unlisted' isn't supported for standalone cards yet, defaulting to private.
      const isPublic = visibility === 'public'; 
      const shouldBePublic = id ? undefined : (isStacker ? isPublic : false);

      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: cardUrl,
          title: title.trim(),
          description: description.trim() || undefined,
          thumbnail_url: thumbnailUrl || undefined,
          collection_id: selectedCollectionId || undefined,
          stack_id: selectedStackId || undefined,
          is_public: shouldBePublic,
          source: id ? 'collection' : 'manual',
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err.error || 'Failed to add card');
        setIsLoading(false);
        return;
      }

      const cardData = await response.json();
      if (cardData.card) {
        const id = selectedCollectionId || selectedStackId || '';
        trackEvent.addCard(user.id, cardData.card.id, id, (cardType || 'link') as any);
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
    setCoverImageFile(null);
    setCoverImagePreview(null);
    setSelectedCollectionId('');
    setSelectedStackId('');
    setError('');
    setIsLoading(false);
    setVisibility('private');
    onClose();
  };

  const handleBack = () => {
    if (step === 'stack') setStep('optional');
    else if (step === 'optional') setStep('details');
    else if (step === 'details') setStep('type');
    setError('');
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <div className="relative overflow-hidden">
        {step === 'type' && (
          <div className="transition-transform duration-300">
            <CardTypeSelector onSelect={handleCardTypeSelect} />
          </div>
        )}

        {step === 'details' && cardType && (
          <div className="transition-transform duration-300">
            <CardDetailsStep
              cardType={cardType}
              url={url}
              onUrlChange={setUrl}
              title={title}
              onTitleChange={(val) => { setTitle(val); titleRef.current = val; }}
              description={description}
              onDescriptionChange={(val) => { setDescription(val); descriptionRef.current = val; }}
              imageFile={imageFile}
              imagePreview={imagePreview}
              imageUrl={imageUrl}
              onImageUrlChange={setImageUrl}
              isDraggingImage={isDraggingImage}
              onImageDragOver={(e) => { e.preventDefault(); setIsDraggingImage(true); }}
              onImageDragLeave={(e) => { e.preventDefault(); setIsDraggingImage(false); }}
              onImageDrop={(e) => {
                e.preventDefault();
                setIsDraggingImage(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileSelect(file, 'image');
              }}
              onImageChange={(e) => handleFileSelect(e.target.files?.[0]!, 'image')}
              docsFile={docsFile}
              isDraggingDocs={isDraggingDocs}
              onDocsDragOver={(e) => { e.preventDefault(); setIsDraggingDocs(true); }}
              onDocsDragLeave={(e) => { e.preventDefault(); setIsDraggingDocs(false); }}
              onDocsDrop={(e) => {
                e.preventDefault();
                setIsDraggingDocs(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileSelect(file, 'docs');
              }}
              onDocsChange={(e) => handleFileSelect(e.target.files?.[0]!, 'docs')}
              isFetchingMetadata={isFetchingMetadata}
              error={error}
              isLoading={isLoading}
              onBack={handleBack}
              onNext={handleDetailsNext}
              // Pass fetch for manual trigger
              onFetchMetadata={() => fetchMetadata(url)}
              // Props not needed for this step anymore, handled in step 2
              isPublic={false} 
              onIsPublicChange={() => {}}
              canMakePublic={false}
            />
          </div>
        )}

        {step === 'optional' && (
          <div className="transition-transform duration-300">
            <OptionalDetailsStep
              visibility={visibility}
              onVisibilityChange={setVisibility}
              coverImage={coverImageFile}
              coverImagePreview={coverImagePreview}
              isDragging={isDraggingCover}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingCover(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDraggingCover(false); }}
              onDrop={handleCoverDrop}
              onImageChange={handleCoverImageChange}
              error={error}
              isLoading={isLoading}
              onBack={handleBack}
              submitLabel="Continue"
              onSubmit={handleOptionalNext}
              showUnlisted={false} // Cards typically just Public/Private for now
            />
          </div>
        )}

        {step === 'stack' && (
          <div className="transition-transform duration-300">
            <StackSelector
              collections={collections}
              selectedCollectionId={selectedCollectionId}
              selectedStackId={selectedStackId}
              onSelect={(id) => { setSelectedCollectionId(id); setSelectedStackId(id); }}
              onCreateNew={() => setIsCreateCollectionModalOpen(true)}
              onBack={handleBack}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              error={error}
            />
          </div>
        )}
      </div>

      <CreateCollectionModal
        isOpen={isCreateCollectionModalOpen}
        onClose={() => setIsCreateCollectionModalOpen(false)}
        fromCardCreation={true}
        onCollectionCreated={(id) => {
          setSelectedCollectionId(id);
          setSelectedStackId(id);
          setIsCreateCollectionModalOpen(false);
        }}
      />

      <BecomeStackerModal
        isOpen={isBecomeStackerModalOpen}
        onClose={() => setIsBecomeStackerModalOpen(false)}
        onSuccess={() => {
          setIsStacker(true);
          setIsBecomeStackerModalOpen(false);
        }}
      />
    </Modal>
  );
}

function setStacks(arg0: { id: any; title: any; description: any; cover_image_url: any; }[]) {
  throw new Error('Function not implemented.');
}
