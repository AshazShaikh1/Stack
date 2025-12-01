'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDisplayName: string;
  currentUsername: string;
  userId: string;
  onUpdate?: (displayName: string) => void;
}

export function EditProfileModal({
  isOpen,
  onClose,
  currentDisplayName,
  currentUsername,
  userId,
  onUpdate,
}: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setDisplayName(currentDisplayName);
      setError('');
    }
  }, [isOpen, currentDisplayName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!displayName.trim()) {
      setError('Display name is required');
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ display_name: displayName.trim() })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      // Callback
      onUpdate?.(displayName.trim());
      
      // Close modal
      onClose();
      
      // Refresh page
      router.refresh();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="p-6">
        <h2 className="text-h1 font-bold text-jet-dark mb-6">Edit Profile</h2>
        
        <div className="space-y-4">
          <Input
            type="text"
            label="Display Name"
            placeholder="Your display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            disabled={isLoading}
          />

          <div>
            <label className="block text-body font-medium text-jet-dark mb-2">
              Username
            </label>
            <input
              type="text"
              value={currentUsername}
              disabled
              className="w-full px-4 py-3 rounded-input border border-gray-light text-body text-gray-muted bg-gray-light cursor-not-allowed"
            />
            <p className="mt-1 text-small text-gray-muted">
              Username cannot be changed
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-small text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
              isLoading={isLoading}
              className="flex-1"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

