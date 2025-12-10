'use client';

import { memo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { FileUploadZone } from './FileUploadZone';

interface CardOptionalDetailsStepProps {
  coverImageFile: File | null;
  coverImagePreview: string | null;
  onCoverImageChange: (file: File) => void;
  isPublic: boolean;
  onIsPublicChange: (isPublic: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean;
}

export const CardOptionalDetailsStep = memo(function CardOptionalDetailsStep({
  coverImageFile,
  coverImagePreview,
  onCoverImageChange,
  isPublic,
  onIsPublicChange,
  onBack,
  onNext,
  isLoading,
}: CardOptionalDetailsStepProps) {
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onCoverImageChange(file);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onNext(); }} className="p-6 space-y-6 max-w-sm mx-auto">
      <h2 className="text-h1 font-bold text-jet-dark mb-2">Optional Details</h2>
      <p className="text-body text-gray-muted mb-6">Customize how your card appears.</p>

      {/* Cover Image Upload */}
      <div className="space-y-3">
        <label className="block text-small font-medium text-jet-dark">
          Cover Image (Optional)
        </label>
        <p className="text-xs text-gray-muted mb-2">
          {coverImagePreview ? 'Current image selected (from metadata or upload).' : 'Upload an image to override the default preview.'}
        </p>
        
        <FileUploadZone
          type="image"
          file={coverImageFile}
          preview={coverImagePreview}
          isDragging={false}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) onCoverImageChange(file);
          }}
          onFileChange={handleFileChange}
          disabled={isLoading}
          label="Click or drag to replace cover image"
        />
      </div>

      {/* Visibility Toggle */}
      <div className="space-y-3 pt-2">
        <label className="block text-small font-medium text-jet-dark">
          Visibility
        </label>
        <div 
          className="flex items-center gap-3 p-3 border border-gray-light rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onIsPublicChange(!isPublic)}
        >
          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isPublic ? 'border-emerald bg-emerald' : 'border-gray-300'}`}>
            {isPublic && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
          </div>
          <div>
            <span className="text-body font-medium text-jet-dark block">Make Public</span>
            <span className="text-xs text-gray-muted">Visible to everyone on Stacq</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
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
});