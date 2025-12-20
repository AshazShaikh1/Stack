'use client';

import { memo, useRef, useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FileUploadZone } from './FileUploadZone';
import { createClient } from '@/lib/supabase/client';
import { Loader } from '@/components/ui/Loader';
import type { CardType } from '@/types';

interface CardDetailsStepProps {
  cardType: CardType;
  url: string;
  onUrlChange: (url: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  imageFile: File | null;
  imagePreview: string | null;
  imageUrl: string;
  onImageUrlChange: (url: string) => void;
  isDraggingImage: boolean;
  onImageDragOver: (e: React.DragEvent) => void;
  onImageDragLeave: (e: React.DragEvent) => void;
  onImageDrop: (e: React.DragEvent) => void;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  docsFile: File | null;
  isDraggingDocs: boolean;
  onDocsDragOver: (e: React.DragEvent) => void;
  onDocsDragLeave: (e: React.DragEvent) => void;
  onDocsDrop: (e: React.DragEvent) => void;
  onDocsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isFetchingMetadata: boolean;
  error: string;
  isLoading: boolean;
  onBack: () => void;
  onNext: () => void;
  isPublic: boolean;
  onIsPublicChange: (isPublic: boolean) => void;
  canMakePublic: boolean;
  onFetchMetadata: () => void;
}

export const CardDetailsStep = memo(function CardDetailsStep({
  cardType,
  url,
  onUrlChange,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  imageFile,
  imagePreview,
  imageUrl,
  onImageUrlChange,
  isDraggingImage,
  onImageDragOver,
  onImageDragLeave,
  onImageDrop,
  onImageChange,
  docsFile,
  isDraggingDocs,
  onDocsDragOver,
  onDocsDragLeave,
  onDocsDrop,
  onDocsChange,
  isFetchingMetadata,
  error,
  isLoading,
  onBack,
  onNext,
  isPublic,
  onIsPublicChange,
  canMakePublic,
  onFetchMetadata,
}: CardDetailsStepProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const focusedInputIdRef = useRef<string | null>(null);
  const cursorPositionRef = useRef<number>(0);

  // New State for Cover Image Toggle
  const [coverMode, setCoverMode] = useState<'url' | 'upload'>('url');
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Restore focus after re-render if an input was focused
  useEffect(() => {
    if (focusedInputIdRef.current) {
      const inputRef = focusedInputIdRef.current === 'card-title-input' 
        ? titleInputRef 
        : descriptionInputRef;
      
      if (inputRef.current && document.activeElement !== inputRef.current) {
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            if (cursorPositionRef.current > 0) {
              inputRef.current.setSelectionRange(
                cursorPositionRef.current, 
                cursorPositionRef.current
              );
            }
          }
        });
      }
    }
  }, [title, description]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    cursorPositionRef.current = e.target.selectionStart || e.target.value.length;
    onTitleChange(e.target.value);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    cursorPositionRef.current = e.target.selectionStart || e.target.value.length;
    onDescriptionChange(e.target.value);
  };

  // Handle Cover Image Upload
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `card-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images') 
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('images').getPublicUrl(filePath);
      onImageUrlChange(data.publicUrl);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploadingCover(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onNext(); }} className="p-6 space-y-4 max-w-sm mx-auto">
      <h2 className="text-h1 font-bold text-jet-dark mb-6">Card Details</h2>

      {/* --- STEP 1: CONTENT INPUT (Based on Type) --- */}
      
      {cardType === 'link' && (
        <Input
          key="card-url-input"
          id="card-url-input"
          type="url"
          label="URL"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          required
          disabled={isLoading || isFetchingMetadata}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onFetchMetadata();
            }
          }}
        />
      )}

      {cardType === 'image' && (
        <FileUploadZone
          type="image"
          file={imageFile}
          preview={imagePreview}
          isDragging={isDraggingImage}
          onDragOver={onImageDragOver}
          onDragLeave={onImageDragLeave}
          onDrop={onImageDrop}
          onFileChange={onImageChange}
          disabled={isLoading}
          imageUrl={imageUrl}
          onImageUrlChange={onImageUrlChange}
        />
      )}

      {cardType === 'docs' && (
        <FileUploadZone
          type="docs"
          file={docsFile}
          preview={null}
          isDragging={isDraggingDocs}
          onDragOver={onDocsDragOver}
          onDragLeave={onDocsDragLeave}
          onDrop={onDocsDrop}
          onFileChange={onDocsChange}
          disabled={isLoading}
        />
      )}

      {isFetchingMetadata && (
        <div className="flex items-center gap-2 text-small text-gray-muted">
          <div className="w-4 h-4 border-2 border-jet border-t-transparent rounded-full animate-spin" />
          Fetching metadata...
        </div>
      )}

      {/* --- STEP 2: METADATA --- */}

      <Input
        key="card-title-input"
        id="card-title-input"
        type="text"
        label="Title"
        placeholder="Card title"
        value={title}
        onChange={handleTitleChange}
        onFocus={(e) => {
          focusedInputIdRef.current = 'card-title-input';
          cursorPositionRef.current = e.target.selectionStart || 0;
        }}
        onBlur={() => {
          if (document.activeElement?.id !== 'card-title-input') focusedInputIdRef.current = null;
        }}
        ref={titleInputRef}
        required
        disabled={isLoading}
      />

      {/* --- COVER IMAGE SECTION (NEW) --- */}
      <div className="space-y-2">
        {/* FIX: Replaced custom Label with standard label tag */}
        <label className="block text-sm font-medium text-jet-dark">
          Cover Image
        </label>
        
        <div className="flex gap-4 mb-2 text-sm">
          <button 
            type="button" 
            onClick={() => setCoverMode('url')}
            className={`pb-1 border-b-2 transition-colors ${coverMode === 'url' ? 'border-emerald text-emerald-dark font-medium' : 'border-transparent text-gray-500'}`}
          >
            Paste URL
          </button>
          <button 
            type="button" 
            onClick={() => setCoverMode('upload')}
            className={`pb-1 border-b-2 transition-colors ${coverMode === 'upload' ? 'border-emerald text-emerald-dark font-medium' : 'border-transparent text-gray-500'}`}
          >
            Upload
          </button>
        </div>

        {coverMode === 'url' && (
          <Input
            placeholder="https://..."
            value={imageUrl || ''}
            onChange={(e) => onImageUrlChange(e.target.value)}
            disabled={isLoading}
          />
        )}

        {coverMode === 'upload' && (
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
            {isUploadingCover ? (
              <Loader size="sm" />
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-2">Click to upload or drag and drop</p>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleCoverUpload} 
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                />
              </>
            )}
          </div>
        )}

        {imageUrl && (
          <div className="mt-3 relative w-full h-40 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
            <img 
              src={imageUrl} 
              alt="Cover Preview" 
              className="w-full h-full object-cover" 
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}
      </div>

      <Input
        key="card-description-input"
        id="card-description-input"
        type="text"
        label="Description"
        placeholder="Card description (optional)"
        value={description}
        onChange={handleDescriptionChange}
        onFocus={(e) => {
          focusedInputIdRef.current = 'card-description-input';
          cursorPositionRef.current = e.target.selectionStart || 0;
        }}
        onBlur={() => {
          if (document.activeElement?.id !== 'card-description-input') focusedInputIdRef.current = null;
        }}
        ref={descriptionInputRef}
        disabled={isLoading}
      />

      {canMakePublic && (
        <div className="flex items-center gap-2 py-2">
          <input
            type="checkbox"
            id="is-public"
            checked={isPublic}
            onChange={(e) => onIsPublicChange(e.target.checked)}
            className="w-4 h-4 text-emerald bg-white border-gray-300 rounded focus:ring-emerald cursor-pointer"
            disabled={isLoading}
          />
          <label htmlFor="is-public" className="text-body text-jet-dark cursor-pointer select-none">
            Make Public (Standalone)
          </label>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-small text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onBack}
          disabled={isLoading}
        >
          Back
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          disabled={isLoading || isFetchingMetadata || isUploadingCover}
        >
          Continue
        </Button>
      </div>
    </form>
  );
});