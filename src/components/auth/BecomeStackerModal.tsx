'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface BecomeStackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  requiredFields?: string[];
}

export function BecomeStackerModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  requiredFields = ['display_name', 'avatar_url', 'short_bio']
}: BecomeStackerModalProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        setUser(user);
        if (user) {
          // Fetch current user profile
          supabase
            .from('users')
            .select('display_name, avatar_url, metadata')
            .eq('id', user.id)
            .single()
            .then(({ data: profile }) => {
              if (profile) {
                setDisplayName(profile.display_name || '');
                setAvatarUrl(profile.avatar_url || '');
                setShortBio(profile.metadata?.short_bio || '');
                setPhone(profile.metadata?.phone || '');
              }
            });
        }
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/users/become-stacker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim(),
          short_bio: shortBio.trim() || undefined,
          avatar_url: avatarUrl || undefined,
          phone: phone.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to become a Stacqer');
      }

      // Refresh session to get updated role
      const supabase = createClient();
      await supabase.auth.refreshSession();

      // Call success callback
      onSuccess();
      onClose();
      
      // Refresh page to update UI
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Become a Stacqer" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-body text-gray-muted mb-4">
            As a Stacker, you can publish public stacks, access creator features, and grow your audience. 
            Complete your profile to get started.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="display_name" className="block text-sm font-medium text-jet-dark mb-1">
            Display Name <span className="text-red-500">*</span>
          </label>
          <input
            id="display_name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={100}
            className="w-full px-4 py-2 border border-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-jet"
            placeholder="Your display name"
          />
        </div>

        {requiredFields.includes('short_bio') && (
          <div>
            <label htmlFor="short_bio" className="block text-sm font-medium text-jet-dark mb-1">
              Short Bio
            </label>
            <textarea
              id="short_bio"
              value={shortBio}
              onChange={(e) => setShortBio(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full px-4 py-2 border border-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-jet"
              placeholder="Tell us about yourself (optional)"
            />
            <p className="text-xs text-gray-muted mt-1">{shortBio.length}/500</p>
          </div>
        )}

        {requiredFields.includes('avatar_url') && (
          <div>
            <label htmlFor="avatar_url" className="block text-sm font-medium text-jet-dark mb-1">
              Avatar URL
            </label>
            <input
              id="avatar_url"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-jet"
              placeholder="https://example.com/avatar.jpg"
            />
            <p className="text-xs text-gray-muted mt-1">Optional - you can upload an avatar later</p>
          </div>
        )}

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-jet-dark mb-1">
            Phone Number (Optional)
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-2 border border-gray-light rounded-lg focus:outline-none focus:ring-2 focus:ring-jet"
            placeholder="+1234567890"
          />
        </div>

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
            disabled={isLoading || !displayName.trim()}
            className="flex-1"
          >
            {isLoading ? 'Processing...' : 'Become a Stacqer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

