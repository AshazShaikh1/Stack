'use client';

interface FileUploadZoneProps {
  type: 'image' | 'docs';
  file: File | null;
  preview: string | null;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  imageUrl?: string;
  onImageUrlChange?: (url: string) => void;
}

export function FileUploadZone({
  type,
  file,
  preview,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
  disabled,
  imageUrl,
  onImageUrlChange,
}: FileUploadZoneProps) {
  const inputId = type === 'image' ? 'image-upload' : 'docs-upload';
  const accept = type === 'image' ? 'image/*' : '.pdf,.doc,.docx,.txt';
  const storagePath = type === 'image' ? 'cards/{user_id}/' : 'docs/{user_id}/';

  return (
    <div>
      <label className="block text-body font-medium text-jet-dark mb-2">
        {type === 'image' ? 'Image' : 'Document'}
      </label>
      
      {/* Image URL toggle (only for images) */}
      {type === 'image' && onImageUrlChange && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => {
                const toggle = document.getElementById('image-method-toggle') as HTMLInputElement;
                if (toggle) toggle.checked = false;
              }}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                !imageUrl
                  ? 'bg-emerald text-white border-emerald shadow-button'
                  : 'bg-white text-jet-dark border-gray-light hover:border-emerald hover:text-emerald'
              }`}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => {
                const toggle = document.getElementById('image-method-toggle') as HTMLInputElement;
                if (toggle) toggle.checked = true;
              }}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                imageUrl
                  ? 'bg-emerald text-white border-emerald shadow-button'
                  : 'bg-white text-jet-dark border-gray-light hover:border-emerald hover:text-emerald'
              }`}
            >
              Image URL
            </button>
          </div>
          
          {imageUrl && (
            <div className="mb-3">
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => onImageUrlChange(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-light text-body text-jet-dark placeholder:text-gray-muted focus:outline-none focus:ring-2 focus:ring-emerald focus:border-transparent"
                disabled={disabled}
              />
              {imageUrl && (
                <div className="mt-2 rounded-lg overflow-hidden bg-gray-light">
                  <img src={imageUrl} alt="Preview" className="w-full h-48 object-cover" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* File Upload Zone (hidden if image URL is active) */}
      {(!imageUrl || type === 'docs') && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`relative w-full border-2 border-dashed rounded-lg transition-all ${
            isDragging
              ? 'border-emerald bg-emerald/5'
              : 'border-gray-light hover:border-emerald/50'
          }`}
        >
          <input
            type="file"
            accept={accept}
            onChange={onFileChange}
            className="hidden"
            id={inputId}
            disabled={disabled}
          />
          <label
            htmlFor={inputId}
            className="flex flex-col items-center justify-center px-4 py-8 cursor-pointer"
          >
            {preview || (type === 'image' && imageUrl) ? (
              <div className="w-full">
                <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-light mb-3">
                  <img src={preview || imageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <p className="text-center text-body text-jet-dark">
                  {file?.name || 'Image from URL'}
                </p>
                <p className="text-center text-small text-gray-muted mt-1">
                  Click or drag to change {type === 'image' ? 'image' : 'document'}
                </p>
              </div>
            ) : file ? (
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
                  {file.name}
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
                  Drag and drop {type === 'image' ? 'an image' : 'a document'} here
                </p>
                <p className="text-small text-gray-muted mb-3">
                  or click to browse
                </p>
                {type === 'docs' && (
                  <p className="text-xs text-gray-muted mb-2">
                    Supported: PDF, DOC, DOCX, TXT
                  </p>
                )}
                <p className="text-xs text-gray-muted">
                  Files are saved to: Supabase Storage → thumbnails bucket → {storagePath}
                </p>
              </>
            )}
          </label>
        </div>
      )}
    </div>
  );
}

