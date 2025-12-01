'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Dropdown } from '@/components/ui/Dropdown';
import { EditCardModal } from '@/components/card/EditCardModal';
import { createClient } from '@/lib/supabase/client';

interface CardPreviewProps {
  card: {
    id: string;
    title?: string;
    description?: string;
    thumbnail_url?: string;
    canonical_url: string;
    domain?: string;
  };
  stackId?: string;
  stackOwnerId?: string;
  addedBy?: string;
}

export function CardPreview({ card, stackId, stackOwnerId, addedBy }: CardPreviewProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  // User can edit/delete if they are the stack owner or the one who added the card
  const canEdit = stackId && user && (user.id === stackOwnerId || user.id === addedBy);

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleDelete = async () => {
    if (!stackId) {
      alert('Stack ID is missing. Cannot delete card.');
      return;
    }

    if (!confirm(`Are you sure you want to delete this card? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/cards/${card.id}?stack_id=${stackId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete card');
      }

      // Force page reload to update the grid
      window.location.reload();
    } catch (error: any) {
      console.error('Error deleting card:', error);
      alert(error.message || 'Failed to delete card');
      setIsDeleting(false);
    }
  };

  const displayTitle = card.title || card.canonical_url;
  const displayDomain = card.domain || (card.canonical_url ? new URL(card.canonical_url).hostname : '');

  return (
    <>
      <div className="relative h-full">
        {/* Dropdown Menu - Only show for owners */}
        {canEdit && (
          <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
            <Dropdown
              items={[
                {
                  label: 'Edit',
                  onClick: handleEdit,
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  ),
                },
                {
                  label: 'Delete',
                  onClick: handleDelete,
                  variant: 'danger',
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  ),
                },
              ]}
            />
          </div>
        )}

        <Link href={card.canonical_url} target="_blank" rel="noopener noreferrer">
          <Card hover className="overflow-hidden h-full flex flex-col">
            {/* Thumbnail */}
            {card.thumbnail_url ? (
              <div className="relative w-full h-48 bg-gray-light">
                <Image
                  src={card.thumbnail_url}
                  alt={displayTitle || 'Card'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                />
              </div>
            ) : (
              <div className="w-full h-48 bg-gradient-to-br from-jet/10 to-gray-light flex items-center justify-center">
                <div className="text-4xl">🔗</div>
              </div>
            )}

            {/* Content */}
            <div className="p-4 flex-1 flex flex-col">
              {/* Title */}
              {card.title && (
                <h3 className="text-h2 font-semibold text-jet-dark mb-2 line-clamp-2">
                  {card.title}
                </h3>
              )}

              {/* Description */}
              {card.description && (
                <p className="text-small text-gray-muted mb-3 line-clamp-2 flex-1">
                  {card.description}
                </p>
              )}

              {/* Domain */}
              <div className="mt-auto pt-3 border-t border-gray-light">
                <span className="text-small text-gray-muted">{displayDomain}</span>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {isEditModalOpen && (
        <EditCardModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          card={{
            id: card.id,
            title: card.title,
            description: card.description,
            thumbnail_url: card.thumbnail_url,
            canonical_url: card.canonical_url,
          }}
        />
      )}
    </>
  );
}

