'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ProfilePictureModal } from './ProfilePictureModal';

interface ProfilePictureEditorProps {
  currentAvatarUrl?: string;
  displayName: string;
  userId: string;
  onUpdate?: (newAvatarUrl: string | null) => void;
}

export function ProfilePictureEditor({
  currentAvatarUrl,
  displayName,
  userId,
  onUpdate,
}: ProfilePictureEditorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const initials = displayName.charAt(0).toUpperCase();

  return (
    <>
      <div className="relative group">
        {currentAvatarUrl ? (
          <Image
            src={currentAvatarUrl}
            alt={displayName}
            width={120}
            height={120}
            className="rounded-full border-4 border-white shadow-card"
          />
        ) : (
          <div className="w-30 h-30 rounded-full bg-gradient-to-br from-jet/20 to-gray-light border-4 border-white shadow-card flex items-center justify-center text-4xl font-bold text-jet">
            {initials}
          </div>
        )}
        <button
          onClick={() => setIsModalOpen(true)}
          className="absolute inset-0 rounded-full bg-black/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        >
          <span className="text-white text-body font-semibold drop-shadow-lg">
            Edit photo
          </span>
        </button>
      </div>

      <ProfilePictureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentAvatarUrl={currentAvatarUrl}
        displayName={displayName}
        userId={userId}
        onUpdate={onUpdate}
      />
    </>
  );
}

