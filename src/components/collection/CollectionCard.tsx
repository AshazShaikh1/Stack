'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Dropdown } from '@/components/ui/Dropdown';
import { EditCollectionModal } from '@/components/collection/EditCollectionModal';
import { createClient } from '@/lib/supabase/client';
import { useSaves } from '@/hooks/useSaves';
import { useVotes } from '@/hooks/useVotes';

interface CollectionCardProps {
  collection: {
    id: string;
    title: string;
    description?: string;
    cover_image_url?: string;
    first_card_thumbnail_url?: string; // First card's thumbnail as fallback
    owner_id: string;
    stats: {
      views: number;
      upvotes: number;
      saves: number;
      comments: number;
    };
    owner?: {
      username: string;
      display_name: string;
      avatar_url?: string;
    };
    is_public?: boolean;
    is_hidden?: boolean;
    tags?: Array<{ id: string; name: string }>;
  };
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Generate deterministic but varied image height based on collection ID
  const getImageHeight = (id: string): number => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const variation = Math.abs(hash) % 5;
    const heights = [200, 240, 280, 320, 360];
    return heights[variation];
  };
  
  const imageHeight = getImageHeight(collection.id);

  // Save functionality for collections
  const { saves: saveCount, saved: isSaved, isLoading: isSaving, isAnimating, toggleSave } = useSaves({
    collectionId: collection.id,
    targetType: 'collection',
    initialSaves: collection.stats?.saves || 0,
    initialSaved: false,
  });

  // Vote functionality for collections
  const { upvotes, voted, isLoading: isVoting, toggleVote } = useVotes({
    targetType: 'collection',
    targetId: collection.id,
    initialUpvotes: collection.stats?.upvotes || 0,
    initialVoted: false,
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const isOwner = user?.id === collection.owner_id;

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${collection.title}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/collections/${collection.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete collection');
      }

      // Refresh the page to update the grid
      router.refresh();
    } catch (error: any) {
      alert(error.message || 'Failed to delete collection');
      setIsDeleting(false);
    }
  };

  const displayName = collection.owner?.display_name || 'Unknown';
  const username = collection.owner?.username || 'unknown';

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (navigator.share) {
      navigator.share({
        title: collection.title,
        text: collection.description || '',
        url: `${window.location.origin}/collection/${collection.id}`,
      }).catch(() => {
        // User cancelled or error occurred
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${window.location.origin}/collection/${collection.id}`);
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
        <Link href={`/collection/${collection.id}`}>
          <Card hover={false} className="overflow-hidden h-full flex flex-col bg-white rounded-card border border-gray-light shadow-card hover:shadow-cardHover transition-all duration-300">
            {/* Image Section with Overlays - Variable height */}
            <div 
              className="relative w-full bg-gray-light overflow-hidden"
              style={{ height: `${imageHeight}px` }}
            >
              {/* Main Image - Use cover_image_url or fallback to first card's thumbnail */}
              {collection.cover_image_url || collection.first_card_thumbnail_url ? (
                <Image
                  src={collection.cover_image_url || collection.first_card_thumbnail_url || ''}
                  alt={collection.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  loading="lazy"
                  priority={false}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald/10 via-emerald/5 to-cloud flex items-center justify-center">
                  <div className="text-5xl opacity-50">📚</div>
                </div>
              )}

              {/* Top Left - Collection Badge (distinctive from cards) */}
              <div className="absolute top-3 left-3 z-20">
                <span className="px-2 py-1 bg-emerald/90 backdrop-blur-sm rounded-md text-xs font-semibold text-white shadow-sm">
                  Collection
                </span>
              </div>

              {/* Top Right - Share and More Options (shown on hover) */}
              <div 
                className={`absolute top-3 right-3 z-20 flex items-center gap-2 transition-opacity duration-200 ${
                  isHovered ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={(e) => e.preventDefault()}
              >
                {/* Share Button - Always visible on hover */}
                <button
                  onClick={handleShare}
                  className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                  aria-label="Share"
                >
                  <svg className="w-4 h-4 text-jet-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>

                {/* More Options - Only show for owners */}
                {isOwner && (
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
                    className={`w-4 h-4 ${voted ? 'fill-emerald text-emerald' : 'text-jet-dark'}`} 
                    fill={voted ? 'currentColor' : 'none'} 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span>{upvotes}</span>
                </button>
                <div className="flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-md text-xs font-medium text-jet-dark">
                  <svg className="w-4 h-4 text-jet-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <span>{saveCount}</span>
                </div>
              </div>

              {/* Bottom Right - Save Button (prominent, shown on hover) - Emerald color for collections */}
              {user && !isOwner && (
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
                        ? 'bg-emerald-dark text-white hover:bg-emerald' 
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
              <h3 className="text-lg font-bold text-jet-dark mb-2 line-clamp-2">
                {collection.title}
              </h3>

              {/* Owner Info - Distinctive for collections */}
              <div className="flex items-center gap-2 mb-2">
                {collection.owner?.avatar_url ? (
                  <Image
                    src={collection.owner.avatar_url}
                    alt={displayName}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-emerald/20 flex items-center justify-center text-xs font-semibold text-emerald">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-gray-muted">by {username}</span>
              </div>

              {/* Description */}
              {collection.description && (
                <p className="text-sm text-gray-muted line-clamp-2 mb-2 flex-1">
                  {collection.description}
                </p>
              )}

              {/* Tags - Show first tag if available */}
              {collection.tags && collection.tags.length > 0 && (
                <div className="mt-auto pt-2">
                  <span className="inline-block px-2 py-1 bg-emerald/10 text-emerald text-xs font-medium rounded-md">
                    {collection.tags[0].name}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </Link>
      </div>

      {isEditModalOpen && (
        <EditCollectionModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          collection={{
            id: collection.id,
            title: collection.title,
            description: collection.description,
            cover_image_url: collection.cover_image_url,
            is_public: collection.is_public ?? true,
            is_hidden: collection.is_hidden ?? false,
            tags: collection.tags || [],
          }}
        />
      )}
    </>
  );
}

