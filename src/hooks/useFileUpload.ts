import { useState, useCallback } from 'react';

interface UseFileUploadOptions {
  accept?: string;
  maxSize?: number; // in bytes
  onError?: (error: string) => void;
}

interface UseFileUploadReturn {
  file: File | null;
  preview: string | null;
  isDragging: boolean;
  handleFileSelect: (file: File) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  reset: () => void;
}

export function useFileUpload({
  accept,
  maxSize,
  onError,
}: UseFileUploadOptions = {}): UseFileUploadReturn {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      // Validate file type
      if (accept && !accept.split(',').some((type) => selectedFile.type.match(type.trim()))) {
        const error = `Invalid file type. Accepted: ${accept}`;
        onError?.(error);
        return;
      }

      // Validate file size
      if (maxSize && selectedFile.size > maxSize) {
        const error = `File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB`;
        onError?.(error);
        return;
      }

      setFile(selectedFile);

      // Create preview for images
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setPreview(null);
      }
    },
    [accept, maxSize, onError]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFileSelect(selectedFile);
      }
    },
    [handleFileSelect]
  );

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setIsDragging(false);
  }, []);

  return {
    file,
    preview,
    isDragging,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileChange,
    reset,
  };
}

