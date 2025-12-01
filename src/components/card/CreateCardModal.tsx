'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface CreateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CardType = 'link' | 'image' | 'docs' | null;
type Step = 'type' | 'details' | 'stack';

export function CreateCardModal({ isOpen, onClose }: CreateCardModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('type');
  const [cardType, setCardType] = useState<CardType>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [docsFile, setDocsFile] = useState<File | null>(null);
  const [stacks, setStacks] = useState<any[]>([]);
  const [selectedStackId, setSelectedStackId] = useState<string>('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isDraggingDocs, setIsDraggingDocs] = useState(false);

  // Fetch user's stacks when modal opens
  useEffect(() => {
    if (isOpen && step === 'stack') {
      fetchStacks();
    }
  }, [isOpen, step]);

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
    if (file) {
      handleFileSelect(file, 'image');
    }
  };

  const handleDocsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file, 'docs');
    }
  };

  const handleDragOver = (e: React.DragEvent, type: 'image' | 'docs') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'image') {
      setIsDraggingImage(true);
    } else {
      setIsDraggingDocs(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent, type: 'image' | 'docs') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'image') {
      setIsDraggingImage(false);
    } else {
      setIsDraggingDocs(false);
    }
  };

  const handleDrop = (e: React.DragEvent, type: 'image' | 'docs') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'image') {
      setIsDraggingImage(false);
    } else {
      setIsDraggingDocs(false);
    }

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file, type);
    }
  };

  const handleUrlChange = async (newUrl: string) => {
    setUrl(newUrl);
    
    if (!newUrl.trim()) {
      setTitle('');
      setDescription('');
      return;
    }

    // Validate URL
    try {
      new URL(newUrl);
    } catch {
      return;
    }

    setIsFetchingMetadata(true);
    try {
      const response = await fetch('/api/cards/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl }),
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

  const handleDetailsNext = () => {
    if (cardType === 'link' && !url.trim()) {
      setError('Please enter a URL');
      return;
    }
    if (cardType === 'image' && !imageFile) {
      setError('Please select an image');
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
    setStep('stack');
  };

  const handleSubmit = async () => {
    if (!selectedStackId) {
      setError('Please select a stack');
      return;
    }

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

      // Handle image upload
      if (cardType === 'image' && imageFile) {
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

      // Create card
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: cardUrl,
          title: title.trim(),
          description: description.trim() || undefined,
          thumbnail_url: thumbnailUrl || undefined,
          stack_id: selectedStackId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add card');
        setIsLoading(false);
        return;
      }

      // Reset and close
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
          <div className="p-6">
            <h2 className="text-h1 font-bold text-jet-dark mb-6">Create Card</h2>
            
            <div className="space-y-3">
              <button
                onClick={() => handleCardTypeSelect('link')}
                className="w-full p-4 rounded-lg border-2 border-gray-light hover:border-jet transition-all duration-200 text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-light flex items-center justify-center flex-shrink-0 group-hover:bg-jet/10 transition-colors">
                    <svg className="w-6 h-6 text-jet-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-h2 font-semibold text-jet-dark mb-1">Link</h3>
                    <p className="text-body text-gray-muted">Add a resource link from the web</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleCardTypeSelect('image')}
                className="w-full p-4 rounded-lg border-2 border-gray-light hover:border-jet transition-all duration-200 text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-light flex items-center justify-center flex-shrink-0 group-hover:bg-jet/10 transition-colors">
                    <svg className="w-6 h-6 text-jet-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-h2 font-semibold text-jet-dark mb-1">Image</h3>
                    <p className="text-body text-gray-muted">Upload an image file</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleCardTypeSelect('docs')}
                className="w-full p-4 rounded-lg border-2 border-gray-light hover:border-jet transition-all duration-200 text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-light flex items-center justify-center flex-shrink-0 group-hover:bg-jet/10 transition-colors">
                    <svg className="w-6 h-6 text-jet-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-h2 font-semibold text-jet-dark mb-1">Document</h3>
                    <p className="text-body text-gray-muted">Upload a document file</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Step 2: Card Details */}
        <div
          className={`transition-transform duration-300 ease-in-out ${
            step === 'details' ? 'translate-x-0' : step === 'type' ? 'translate-x-full absolute inset-0' : '-translate-x-full absolute inset-0'
          }`}
        >
          <form onSubmit={(e) => { e.preventDefault(); handleDetailsNext(); }} className="p-6 space-y-4 max-w-sm mx-auto">
            <h2 className="text-h1 font-bold text-jet-dark mb-6">Card Details</h2>

            {/* Link Input */}
            {cardType === 'link' && (
              <Input
                type="url"
                label="URL"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                required
                disabled={isLoading || isFetchingMetadata}
              />
            )}

            {/* Image Input */}
            {cardType === 'image' && (
              <div>
                <label className="block text-body font-medium text-jet-dark mb-2">
                  Image
                </label>
                <div
                  onDragOver={(e) => handleDragOver(e, 'image')}
                  onDragLeave={(e) => handleDragLeave(e, 'image')}
                  onDrop={(e) => handleDrop(e, 'image')}
                  className={`relative w-full border-2 border-dashed rounded-lg transition-all ${
                    isDraggingImage
                      ? 'border-jet bg-jet/5'
                      : 'border-gray-light hover:border-jet/50'
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="image-upload"
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="image-upload"
                    className="flex flex-col items-center justify-center px-4 py-8 cursor-pointer"
                  >
                    {imagePreview ? (
                      <div className="w-full">
                        <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-light mb-3">
                          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                        <p className="text-center text-body text-jet-dark">
                          {imageFile?.name}
                        </p>
                        <p className="text-center text-small text-gray-muted mt-1">
                          Click or drag to change image
                        </p>
                      </div>
                    ) : (
                      <>
                        <svg
                          className="w-12 h-12 text-gray-muted mb-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <p className="text-body text-jet-dark font-medium mb-1">
                          Drag and drop an image here
                        </p>
                        <p className="text-small text-gray-muted mb-3">
                          or click to browse
                        </p>
                        <p className="text-xs text-gray-muted">
                          Files are saved to: Supabase Storage → thumbnails bucket → cards/{'{user_id}'}/
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>
            )}

            {/* Docs Input */}
            {cardType === 'docs' && (
              <div>
                <label className="block text-body font-medium text-jet-dark mb-2">
                  Document
                </label>
                <div
                  onDragOver={(e) => handleDragOver(e, 'docs')}
                  onDragLeave={(e) => handleDragLeave(e, 'docs')}
                  onDrop={(e) => handleDrop(e, 'docs')}
                  className={`relative w-full border-2 border-dashed rounded-lg transition-all ${
                    isDraggingDocs
                      ? 'border-jet bg-jet/5'
                      : 'border-gray-light hover:border-jet/50'
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleDocsChange}
                    className="hidden"
                    id="docs-upload"
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="docs-upload"
                    className="flex flex-col items-center justify-center px-4 py-8 cursor-pointer"
                  >
                    {docsFile ? (
                      <>
                        <svg
                          className="w-12 h-12 text-jet mb-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <p className="text-body text-jet-dark font-medium mb-1">
                          {docsFile.name}
                        </p>
                        <p className="text-small text-gray-muted">
                          Click or drag to change document
                        </p>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-12 h-12 text-gray-muted mb-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <p className="text-body text-jet-dark font-medium mb-1">
                          Drag and drop a document here
                        </p>
                        <p className="text-small text-gray-muted mb-3">
                          or click to browse
                        </p>
                        <p className="text-xs text-gray-muted mb-2">
                          Supported: PDF, DOC, DOCX, TXT
                        </p>
                        <p className="text-xs text-gray-muted">
                          Files are saved to: Supabase Storage → thumbnails bucket → docs/{'{user_id}'}/
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>
            )}

            {isFetchingMetadata && (
              <div className="flex items-center gap-2 text-small text-gray-muted">
                <div className="w-4 h-4 border-2 border-jet border-t-transparent rounded-full animate-spin" />
                Fetching metadata...
              </div>
            )}

            <Input
              type="text"
              label="Title"
              placeholder="Card title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={isLoading}
            />

            <Input
              type="text"
              label="Description"
              placeholder="Card description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-small text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleBack}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                disabled={isLoading}
              >
                Continue
              </Button>
            </div>
          </form>
        </div>

        {/* Step 3: Stack Selection */}
        <div
          className={`transition-transform duration-300 ease-in-out ${
            step === 'stack' ? 'translate-x-0' : 'translate-x-full absolute inset-0'
          }`}
        >
          <div className="p-6 space-y-4 max-w-sm mx-auto">
            <h2 className="text-h1 font-bold text-jet-dark mb-6">Select Stack</h2>

            {stacks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-body text-gray-muted mb-4">
                  You don't have any stacks yet. Create one first!
                </p>
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stacks.map((stack) => (
                    <button
                      key={stack.id}
                      onClick={() => setSelectedStackId(stack.id)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        selectedStackId === stack.id
                          ? 'border-jet bg-jet/5'
                          : 'border-gray-light hover:border-jet/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {stack.cover_image_url ? (
                          <img
                            src={stack.cover_image_url}
                            alt={stack.title}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-light flex items-center justify-center text-jet font-semibold">
                            {stack.title.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-body font-semibold text-jet-dark">{stack.title}</h3>
                          {stack.description && (
                            <p className="text-small text-gray-muted line-clamp-1">{stack.description}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-small text-red-600">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleBack}
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    className="flex-1"
                    onClick={handleSubmit}
                    isLoading={isLoading}
                    disabled={!selectedStackId}
                  >
                    Create Card
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

