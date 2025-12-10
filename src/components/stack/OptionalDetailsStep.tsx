'use client';

import { Button } from '@/components/ui/Button';
import { FileUploadZone } from '@/components/card/FileUploadZone';
import type { StackVisibility } from '@/types';

interface OptionalDetailsStepProps {
  visibility: StackVisibility;
  onVisibilityChange: (visibility: StackVisibility) => void;
  coverImage: File | null;
  coverImagePreview: string | null;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error: string;
  isLoading: boolean;
  onBack: () => void;
  // Optional submit button text (default: "Create Collection")
  submitLabel?: string;
  onSubmit?: () => void;
  // Allow hiding specific visibility options if needed (e.g. cards might not support unlisted)
  showUnlisted?: boolean;
}

export function OptionalDetailsStep({
  visibility,
  onVisibilityChange,
  coverImage,
  coverImagePreview,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onImageChange,
  error,
  isLoading,
  onBack,
  submitLabel = "Create Collection",
  onSubmit,
  showUnlisted = true,
}: OptionalDetailsStepProps) {
  
  // Wrapper for FileUploadZone to match the prop signature if needed, 
  // or just use FileUploadZone directly.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onImageChange(e);
  };

  return (
    <div className="space-y-6 max-w-md mx-auto p-1">
      <div className="flex items-center gap-3 mb-2">
        <button
          type="button"
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-light transition-colors"
          disabled={isLoading}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h3 className="text-h2 font-semibold text-jet-dark">Optional Details</h3>
      </div>

      {/* Visibility Section - Now at the Top */}
      <div>
        <label className="block text-body font-medium text-jet-dark mb-3">
          Visibility
        </label>
        <div className="space-y-3">
          <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${visibility === 'public' ? 'border-emerald bg-emerald/5' : 'border-gray-light hover:bg-gray-50'}`}>
            <input
              type="radio"
              name="visibility"
              value="public"
              checked={visibility === 'public'}
              onChange={(e) => onVisibilityChange(e.target.value as StackVisibility)}
              className="mt-1 w-4 h-4 text-emerald focus:ring-emerald"
              disabled={isLoading}
            />
            <div>
              <div className="text-body font-medium text-jet-dark">Public</div>
              <div className="text-small text-gray-muted">Visible to everyone on Stacq. Discoverable in search and feed.</div>
            </div>
          </label>
          
          <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${visibility === 'private' ? 'border-emerald bg-emerald/5' : 'border-gray-light hover:bg-gray-50'}`}>
            <input
              type="radio"
              name="visibility"
              value="private"
              checked={visibility === 'private'}
              onChange={(e) => onVisibilityChange(e.target.value as StackVisibility)}
              className="mt-1 w-4 h-4 text-emerald focus:ring-emerald"
              disabled={isLoading}
            />
            <div>
              <div className="text-body font-medium text-jet-dark">Private</div>
              <div className="text-small text-gray-muted">Only you can view this content.</div>
            </div>
          </label>

          {showUnlisted && (
            <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${visibility === 'unlisted' ? 'border-emerald bg-emerald/5' : 'border-gray-light hover:bg-gray-50'}`}>
              <input
                type="radio"
                name="visibility"
                value="unlisted"
                checked={visibility === 'unlisted'}
                onChange={(e) => onVisibilityChange(e.target.value as StackVisibility)}
                className="mt-1 w-4 h-4 text-emerald focus:ring-emerald"
                disabled={isLoading}
              />
              <div>
                <div className="text-body font-medium text-jet-dark">Unlisted</div>
                <div className="text-small text-gray-muted">Only people with the link can view. Hidden from search.</div>
              </div>
            </label>
          )}
        </div>
      </div>

      {/* Cover Image Section - Now at the Bottom */}
      <div>
        <div className="mb-2">
          <label className="block text-body font-medium text-jet-dark">
            Cover Image <span className="text-gray-muted font-normal text-sm">(optional)</span>
          </label>
          <p className="text-xs text-gray-muted mt-1">
            {coverImagePreview ? 'This image will override any default metadata image.' : 'Upload a custom cover image.'}
          </p>
        </div>
        
        <FileUploadZone
          type="image"
          file={coverImage}
          preview={coverImagePreview}
          isDragging={isDragging}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onFileChange={handleFileChange}
          disabled={isLoading}
          label="Click or drag to replace cover image"
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
          onClick={onBack}
          disabled={isLoading}
        >
          Back
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          onClick={(e) => {
            if (onSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}