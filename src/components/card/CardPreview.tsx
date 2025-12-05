'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Dropdown } from '@/components/ui/Dropdown';
import { Button } from '@/components/ui/Button';
import { EditCardModal } from '@/components/card/EditCardModal';
import { createClient } from '@/lib/supabase/client';
import { useSaves } from '@/hooks/useSaves';
import { useVotes } from '@/hooks/useVotes';
import { generatePlaceholderImage } from '@/lib/utils/placeholder';

interface CardPreviewProps {
  card: {
    id: string;
    title?: string;
    description?: string;
    thumbnail_url?: string;
    canonical_url: string;
    domain?: string;
    metadata?: {
      saves?: number;
      upvotes?: number;
    };
    created_by?: string; // Card creator ID
  };
  stackId?: string; // Legacy support
  stackOwnerId?: string; // Legacy support
  collectionId?: string;
  collectionOwnerId?: string;
  addedBy?: string;
}

export function CardPreview({ card, stackId, stackOwnerId, collectionId, collectionOwnerId, addedBy }: CardPreviewProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Generate deterministic but varied image height based on card ID
  // This ensures each card always has the same height but different cards vary
  const getImageHeight = (id: string): number => {
    // Simple hash function to convert ID to a number
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Use absolute value and modulo to get a value between 0-4
    const variation = Math.abs(hash) % 5;
    
    // Map to different heights: 200px (short), 240px, 280px, 320px, 360px (tall)
    // This creates a nice variety without being too extreme
    const heights = [200, 240, 280, 320, 360];
    return heights[variation];
  };
  
  const imageHeight = getImageHeight(card.id);
  
  // Save functionality for cards
  const { saves: saveCount, saved: isSaved, isLoading: isSaving, isAnimating, toggleSave } = useSaves({
    cardId: card.id,
    targetType: 'card',
    initialSaves: card.metadata?.saves || 0,
    initialSaved: false,
  });

  // Vote functionality for cards
  const { upvotes, voted, isLoading: isVoting, toggleVote } = useVotes({
    targetType: 'card',
    targetId: card.id,
    initialUpvotes: card.metadata?.upvotes || 0,
    initialVoted: false,
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const ownerId = collectionOwnerId || stackOwnerId;
  const id = collectionId || stackId;
  
  // User can edit/delete if they are:
  // 1. The collection/stack owner
  // 2. The one who added the card to the collection/stack
  // 3. The card creator (for standalone cards)
  const canEdit = user && (
    (id && (user.id === ownerId || user.id === addedBy)) ||
    (!id && card.created_by && user.id === card.created_by)
  );

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete this card? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      // If card is in a collection/stack, include that in the query
      let url = `/api/cards/${card.id}`;
      if (id) {
        const queryParam = collectionId ? `collection_id=${collectionId}` : `stack_id=${stackId}`;
        url += `?${queryParam}`;
      }
      
      const response = await fetch(url, {
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
  
  // Get image URL - use thumbnail_url if available, otherwise use a local placeholder
  // Memoize placeholder to avoid recalculating on every render
  const placeholderUrl = useMemo(() => generatePlaceholderImage(
    imageHeight * 1.33, // Approximate width based on height
    imageHeight,
    displayTitle.substring(0, 15) || 'Card'
  ), [imageHeight, displayTitle]);
  
  // Initialize with thumbnail_url if available, otherwise placeholder
  const [imageUrl, setImageUrl] = useState<string>(() => 
    card.thumbnail_url || placeholderUrl
  );
  const [imageError, setImageError] = useState(false);

  // Update image URL when card.thumbnail_url changes
  useEffect(() => {
    if (card.thumbnail_url) {
      setImageUrl(card.thumbnail_url);
      setImageError(false);
    } else {
      // Set placeholder if no thumbnail_url
      setImageUrl(placeholderUrl);
    }
  }, [card.thumbnail_url, placeholderUrl]);

  // Try to fetch image if not available (debounced and only if needed)
  useEffect(() => {
    // Only fetch if:
    // 1. No thumbnail_url exists
    // 2. We have a canonical_url
    // 3. We haven't already tried and failed
    // 4. We're not already showing a placeholder (avoid unnecessary fetches)
    if (!card.thumbnail_url && card.canonical_url && !imageError && imageUrl === placeholderUrl) {
      // Longer debounce to avoid overwhelming the server with requests
      // Also helps batch requests if multiple cards need metadata
      const controller = new AbortController();
      let timeoutId: NodeJS.Timeout;
      
      timeoutId = setTimeout(() => {
        // Trigger metadata fetch in background to get thumbnail
        fetch(`/api/cards/metadata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: card.canonical_url }),
          signal: controller.signal,
        })
          .then(res => res.json())
          .then(data => {
            if (data.thumbnail_url) {
              setImageUrl(data.thumbnail_url);
            }
          })
          .catch((err) => {
            // Only set error if it's not an abort (component unmounted or timeout)
            if (err.name !== 'AbortError') {
              setImageError(true);
            }
          });
      }, 3000); // 3 second debounce - reduces server load significantly
      
      return () => {
        clearTimeout(timeoutId);
        controller.abort();
      };
    }
  }, [card.thumbnail_url, card.canonical_url, imageError, imageUrl, placeholderUrl]);

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (navigator.share) {
      navigator.share({
        title: card.title || 'Check this out',
        text: card.description || '',
        url: card.canonical_url,
      }).catch(() => {
        // User cancelled or error occurred
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(card.canonical_url);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <>
      <div 
        className="relative h-full group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Link href={card.canonical_url} target="_blank" rel="noopener noreferrer">
          <Card hover={false} className="overflow-hidden h-full flex flex-col bg-white rounded-card border border-gray-light shadow-card hover:shadow-cardHover transition-all duration-300">
            {/* Image Section with Overlays - Variable height based on card ID */}
            <div 
              className="relative w-full bg-gray-light overflow-hidden"
              style={{ height: `${imageHeight}px` }}
            >
              {/* Main Image - Always show an image */}
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={displayTitle || 'Card'}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  unoptimized={imageUrl.startsWith('data:')}
                  loading="lazy"
                  priority={false}
                  onError={() => {
                    // Fallback to local placeholder if image fails to load
                    // Only do this if we haven't already shown the placeholder
                    if (!imageError && !imageUrl.startsWith('data:')) {
                      setImageError(true);
                      setImageUrl(placeholderUrl);
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-jet/10 via-gray-light to-jet/5 flex items-center justify-center">
                  <div className="text-5xl opacity-50">🔗</div>
                </div>
              )}

              {/* Top Left - Tag/Badge (optional) */}
              {card.domain && (
                <div className="absolute top-3 left-3 z-20">
                  <span className="px-2 py-1 bg-white/90 backdrop-blur-sm rounded-md text-xs font-medium text-jet-dark">
                    {card.domain}
                  </span>
                </div>
              )}

              {/* Top Right - Share and More Options (shown on hover) */}
              <div 
                className={`absolute top-3 right-3 z-20 flex gap-2 transition-opacity duration-200 ${
                  isHovered ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={(e) => e.preventDefault()}
              >
                {/* Share Button */}
                <button
                  onClick={handleShare}
                  className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                  aria-label="Share"
                >
                  <svg className="w-4 h-4 text-jet-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>

                {/* More Options - Only show for owners/creators */}
                {canEdit && (
                  <div className="relative">
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
                      className="w-8 h-8"
                    >
                      <div className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm pointer-events-none">
                        <svg className="w-4 h-4 text-jet-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </div>
                    </Dropdown>
                  </div>
                )}
              </div>

              {/* Bottom Left - Engagement Metrics (shown on hover) */}
              <div 
                className={`absolute bottom-3 left-3 z-20 flex items-center gap-3 transition-opacity duration-200 ${
                  isHovered ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleVote();
                  }}
                  disabled={isVoting}
                  className="flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-md text-xs font-medium text-jet-dark hover:bg-white transition-colors"
                >
                  <svg 
                    className={`w-4 h-4 ${voted ? 'fill-red-500 text-red-500' : 'text-jet-dark'}`} 
                    fill={voted ? 'currentColor' : 'none'} 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span>{upvotes}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSave();
                  }}
                  disabled={isSaving}
                  className={`flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-md text-xs font-medium text-jet-dark hover:bg-white transition-colors ${
                    isSaved ? 'text-emerald' : ''
                  }`}
                >
                  <svg 
                    className={`w-4 h-4 ${isSaved ? 'fill-emerald text-emerald' : 'text-jet-dark'}`}
                    fill={isSaved ? 'currentColor' : 'none'}
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <span>{saveCount}</span>
                </button>
              </div>

              {/* Bottom Right - Save Button (prominent, shown on hover) */}
              {user && (
                <div 
                  className={`absolute bottom-3 right-3 z-20 transition-opacity duration-200 ${
                    isHovered ? 'opacity-100' : 'opacity-0'
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSave();
                  }}
                >
                  <button
                    disabled={isSaving}
                    className={`
                      px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 shadow-button hover:shadow-buttonHover
                      ${isSaved 
                        ? 'bg-emerald text-white hover:bg-emerald-dark' 
                        : 'bg-emerald text-white hover:bg-emerald-dark'
                      }
                      ${isAnimating ? 'animate-pulse scale-110' : ''}
                    `}
                  >
                    {isSaved ? 'Saved' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {/* Content Section */}
            <div className="p-4 flex-1 flex flex-col">
              {/* Title */}
              {card.title && (
                <h3 className="text-lg font-bold text-jet-dark mb-2 line-clamp-2">
                  {card.title}
                </h3>
              )}

              {/* Link with External Icon */}
              <div className="mt-auto pt-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span className="text-sm text-gray-muted truncate">{displayDomain}</span>
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

