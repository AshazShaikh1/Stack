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
}: OptionalDetailsStepProps) {
  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-4">
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
              onChange={(e) => onVisibilityChange(e.target.value as StackVisibility)}
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
              onChange={(e) => onVisibilityChange(e.target.value as StackVisibility)}
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
              onChange={(e) => onVisibilityChange(e.target.value as StackVisibility)}
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
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`relative w-full border-2 border-dashed rounded-lg transition-all ${
            isDragging
              ? 'border-jet bg-jet/5'
              : 'border-gray-light hover:border-jet/50'
          }`}
        >
          <input
            type="file"
            accept="image/*"
            onChange={onImageChange}
            className="hidden"
            id="cover-image-upload"
            disabled={isLoading}
          />
          <label
            htmlFor="cover-image-upload"
            className="flex flex-col items-center justify-center px-4 py-8 cursor-pointer"
          >
            {coverImagePreview ? (
              <div className="w-full">
                <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-light mb-3">
                  <img src={coverImagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <p className="text-center text-body text-jet-dark">
                  {coverImage?.name}
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
                  Files are saved to: Supabase Storage → cover-images bucket → {`{user_id}`}/
                </p>
              </>
            )}
          </label>
        </div>
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
          onClick={onBack}
          disabled={isLoading}
        >
          Back
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
        >
          Create Collection
        </Button>
      </div>
    </div>
  );
}

