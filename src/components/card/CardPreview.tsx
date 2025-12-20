"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Dropdown } from "@/components/ui/Dropdown";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EditCardModal } from "@/components/card/EditCardModal";
import { createClient } from "@/lib/supabase/client";
import { useSaves } from "@/hooks/useSaves";
import { useVotes } from "@/hooks/useVotes";
import { useToast } from "@/contexts/ToastContext";

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
      affiliate_url?: string;
      is_amazon_product?: boolean;
    };
    created_by?: string;
    creator?: {
      username?: string;
      display_name?: string;
    };
  };
  stackId?: string;
  stackOwnerId?: string;
  collectionId?: string;
  collectionOwnerId?: string;
  addedBy?: string;
  hideHoverButtons?: boolean;
}

export function CardPreview({
  card,
  stackId,
  stackOwnerId,
  collectionId,
  collectionOwnerId,
  addedBy,
  hideHoverButtons = false,
}: CardPreviewProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  const contextId = collectionId || stackId;
  const contextOwnerId = collectionOwnerId || stackOwnerId;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user?.id || null);
    });
  }, []);

  const canEdit = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser === card.created_by || 
      currentUser === contextOwnerId || 
      currentUser === addedBy
    );
  }, [currentUser, card.created_by, contextOwnerId, addedBy]);

  // FIX: Destructure 'saved' and alias it to 'isSaved'
  const { saved: isSaved, toggleSave, isLoading: isSaveLoading } = useSaves({
    targetId: card.id,
    targetType: "card",
    initialSaved: false,
    initialSaves: card.metadata?.saves || 0
  });
  
  // FIX: Destructure 'voted' and 'upvotes' from the hook directly
  const { voted: hasUpvoted, upvotes: voteCount, toggleVote, isLoading: isVoteLoading } = useVotes({
    targetId: card.id,
    targetType: "card",
    initialVoted: false,
    initialUpvotes: card.metadata?.upvotes || 0
  });

  const [imageError, setImageError] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const getFaviconUrl = (domain: string) => {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  };

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  const handleDelete = async () => {
    try {
      const supabase = createClient();
      if (contextId) {
        const { error } = await supabase
          .from('collection_cards')
          .delete()
          .match({ collection_id: contextId, card_id: card.id });
        
        if (error) throw error;
        showSuccess("Card removed from collection");
      } else {
        const { error } = await supabase
            .from('cards')
            .delete()
            .eq('id', card.id);

        if (error) throw error;
        showSuccess("Card deleted permanently");
      }
      router.refresh();
    } catch (error: any) {
      showError(error.message || "Failed to delete");
    } finally {
      setIsDeleteConfirmOpen(false);
    }
  };

  return (
    <>
      <Card className="group relative flex flex-col h-full overflow-hidden hover:shadow-card-hover transition-all duration-300 border-border/50 bg-white">
        
        {/* --- THUMBNAIL (Link to Details) --- */}
        <Link href={`/card/${card.id}`} className="relative aspect-[1.91/1] bg-gray-100 overflow-hidden cursor-pointer block">
          {card.thumbnail_url && !imageError ? (
            <Image
              src={card.thumbnail_url}
              alt={card.title || "Card thumbnail"}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImageError(true)}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-400">
              <span className="text-4xl">📄</span>
            </div>
          )}

          {/* Darken on Desktop Hover */}
          <div className="absolute inset-0 bg-black/0 sm:group-hover:bg-black/5 transition-colors duration-300" />

          {/* --- ACTION BUTTONS --- */}
          {!hideHoverButtons && (
            <div className="absolute top-2 right-2 flex gap-2 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
              
              {/* SAVE BUTTON */}
              <button
                onClick={(e) => handleAction(e, toggleSave)}
                disabled={isSaveLoading}
                className={`
                  p-2 rounded-full backdrop-blur-md shadow-sm transition-all border border-transparent
                  ${isSaved 
                    ? "bg-jet text-white border-jet" 
                    : "bg-white/90 text-gray-700 hover:bg-white hover:text-jet hover:border-gray-200"
                  }
                `}
                aria-label={isSaved ? "Unsave" : "Save"}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" height="16" 
                  viewBox="0 0 24 24" 
                  fill={isSaved ? "currentColor" : "none"} 
                  stroke="currentColor" 
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
                </svg>
              </button>
              
              {/* MENU DROPDOWN (Edit/Delete) */}
              {canEdit && (
                <div onClick={(e) => e.stopPropagation()} className="relative">
                  {/* FIX: Passed Icon as children, removed invalid 'trigger' prop */}
                  <Dropdown
                    items={[
                      { 
                        label: "Edit Card", 
                        onClick: () => setIsEditModalOpen(true), 
                        icon: "✏️" 
                      },
                      { 
                        label: contextId ? "Remove from Collection" : "Delete Card", 
                        onClick: () => setIsDeleteConfirmOpen(true), 
                        icon: "🗑️", 
                        variant: 'danger' 
                      }
                    ]}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="20" height="20" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      className="text-gray-700 drop-shadow-sm"
                    >
                      <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
                    </svg>
                  </Dropdown>
                </div>
              )}
            </div>
          )}
        </Link>

        {/* --- CONTENT --- */}
        <div className="p-4 flex flex-col flex-grow">
          <div className="flex items-center gap-2 mb-2">
            {card.domain && (
              <div className="flex items-center gap-1.5 min-w-0">
                <img 
                  src={getFaviconUrl(card.domain)} 
                  alt="" 
                  className="w-4 h-4 rounded-sm flex-shrink-0"
                  onError={(e) => e.currentTarget.style.display = 'none'} 
                />
                <span className="text-xs text-gray-500 truncate">{card.domain}</span>
              </div>
            )}
          </div>

          <Link href={`/card/${card.id}`} className="block group-hover:text-emerald-dark transition-colors">
            <h3 className="font-semibold text-jet-dark line-clamp-2 mb-1.5 leading-snug">
              {card.title || "Untitled Card"}
            </h3>
          </Link>
          
          {card.description && (
            <p className="text-sm text-gray-muted line-clamp-2 mb-4 leading-relaxed">
              {card.description}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-50">
            <div className="flex items-center gap-2">
              {card.creator?.username ? (
                <Link 
                  href={`/profile/${card.creator.username}`}
                  className="text-xs text-gray-400 hover:text-emerald hover:underline transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  By {card.creator.display_name || card.created_by}
                </Link>
              ) : (
                <span className="text-xs text-gray-400">
                   By {card.creator?.display_name || "Anonymous"}
                </span>
              )}
            </div>

            <button 
              onClick={(e) => handleAction(e, toggleVote)}
              disabled={isVoteLoading}
              className={`
                flex items-center gap-1.5 text-xs font-medium transition-colors px-2 py-1 rounded-full
                ${hasUpvoted 
                  ? "text-emerald bg-emerald/10" 
                  : "text-gray-400 hover:text-emerald hover:bg-emerald/5"
                }
              `}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="14" height="14" 
                viewBox="0 0 24 24" 
                fill={hasUpvoted ? "currentColor" : "none"}
                stroke="currentColor" 
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="m12 19-7-7 7-7"/>
                <path d="M19 12H5"/>
              </svg>
              {voteCount}
            </button>
          </div>
        </div>
      </Card>

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

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title={contextId ? "Remove Card from Collection" : "Delete Card"}
        message={
          contextId
            ? "Are you sure you want to remove this card from the collection? This action cannot be undone."
            : "Are you sure you want to delete this card permanently? This action cannot be undone."
        }
        confirmText={contextId ? "Remove" : "Delete"}
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
}