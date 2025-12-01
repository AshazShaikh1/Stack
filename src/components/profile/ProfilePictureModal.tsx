'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ProfilePictureModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string;
  displayName: string;
  userId: string;
  onUpdate?: (newAvatarUrl: string | null) => void;
}

export function ProfilePictureModal({
  isOpen,
  onClose,
  currentAvatarUrl,
  displayName,
  userId,
  onUpdate,
}: ProfilePictureModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setImageFile(null);
      setImagePreview(null);
      setError('');
      setIsDragging(false);
    }
  }, [isOpen]);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    setImageFile(file);
    setError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    if (!imageFile) return;

    setIsUploading(true);
    setError('');

    try {
      const supabase = createClient();
      
      // Delete old avatar if exists
      if (currentAvatarUrl) {
        // Extract file path from URL
        const urlParts = currentAvatarUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const filePath = `${userId}/${fileName}`;
        
        await supabase.storage
          .from('avatars')
          .remove([filePath]);
      }

      // Upload new avatar
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, imageFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      // Reset state
      setImageFile(null);
      setImagePreview(null);
      
      // Callback
      onUpdate?.(publicUrl);
      
      // Close modal
      onClose();
      
      // Refresh page to show new avatar
      router.refresh();
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      setError(err.message || 'Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentAvatarUrl) return;

    setIsUploading(true);
    setError('');

    try {
      const supabase = createClient();
      
      // Delete from storage
      const urlParts = currentAvatarUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `${userId}/${fileName}`;
      
      const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove([filePath]);

      if (deleteError) {
        throw deleteError;
      }

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: null })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      // Reset state
      setImageFile(null);
      setImagePreview(null);
      
      // Callback
      onUpdate?.(null);
      
      // Close modal
      onClose();
      
      // Refresh page
      router.refresh();
    } catch (err: any) {
      console.error('Error deleting avatar:', err);
      setError(err.message || 'Failed to delete avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setImageFile(null);
    setImagePreview(null);
    setError('');
    setIsDragging(false);
    onClose();
  };

  const initials = displayName.charAt(0).toUpperCase();

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} size="md">
      <div className="p-6">
        <h2 className="text-h1 font-bold text-jet-dark mb-6">Edit Profile Picture</h2>
        
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative w-full border-2 border-dashed rounded-lg transition-all mb-4 ${
            isDragging
              ? 'border-jet bg-jet/5'
              : 'border-gray-light hover:border-jet/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isUploading}
          />
          
          <div className="flex flex-col items-center justify-center px-4 py-12">
            {imagePreview ? (
              <div className="relative w-48 h-48 rounded-full overflow-hidden mb-4">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  fill
                  className="object-cover"
                />
              </div>
            ) : currentAvatarUrl ? (
              <div className="relative w-48 h-48 rounded-full overflow-hidden mb-4">
                <Image
                  src={currentAvatarUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-48 h-48 rounded-full bg-gradient-to-br from-jet/20 to-gray-light flex items-center justify-center text-6xl font-bold text-jet mb-4">
                {initials}
              </div>
            )}
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-body text-jet-dark hover:text-jet transition-colors"
            >
              {!imagePreview && !currentAvatarUrl ? (
                <>
                  <svg
                    className="w-12 h-12 mx-auto mb-3 text-gray-muted"
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
                  <p className="text-body font-medium mb-1">Drag and drop an image here</p>
                  <p className="text-small text-gray-muted">or click to browse</p>
                </>
              ) : (
                <p className="text-body font-medium">Click or drag to change photo</p>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-small text-red-600 mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          {imageFile && (
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              variant="primary"
              className="flex-1"
            >
              {isUploading ? 'Uploading...' : 'Save'}
            </Button>
          )}
          {currentAvatarUrl && (
            <Button
              onClick={handleDelete}
              disabled={isUploading}
              variant="outline"
              className="flex-1 text-red-600 hover:text-red-700 hover:border-red-600"
            >
              {isUploading ? 'Deleting...' : 'Delete'}
            </Button>
          )}
          <Button
            onClick={handleCancel}
            disabled={isUploading}
            variant="outline"
            className="flex-1"
          >
            Cancel
          </Button>
        </div>

        <p className="mt-4 text-xs text-gray-muted text-center">
          Files are saved to: Supabase Storage → avatars bucket → {userId}/
        </p>
      </div>
    </Modal>
  );
}

