'use client';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FileUploadZone } from './FileUploadZone';
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
}

export function CardDetailsStep({
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
}: CardDetailsStepProps) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onNext(); }} className="p-6 space-y-4 max-w-sm mx-auto">
      <h2 className="text-h1 font-bold text-jet-dark mb-6">Card Details</h2>

      {/* Link Input */}
      {cardType === 'link' && (
        <Input
          type="url"
          label="URL"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          required
          disabled={isLoading || isFetchingMetadata}
        />
      )}

      {/* Image Input */}
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

      {/* Docs Input */}
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

      <Input
        type="text"
        label="Title"
        placeholder="Card title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        required
        disabled={isLoading}
      />

      <Input
        type="text"
        label="Description"
        placeholder="Card description (optional)"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
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
          onClick={onBack}
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
  );
}

