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
import { generatePlaceholderImage } from "@/lib/utils/placeholder";
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
  const [user, setUser] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const getImageHeight = (id: string): number => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    const variation = Math.abs(hash) % 5;
    const heights = [200, 240, 280, 320, 360];
    return heights[variation];
  };

  const imageHeight = getImageHeight(card.id);

  const {
    saves: saveCount,
    saved: isSaved,
    isLoading: isSaving,
    isAnimating,
    toggleSave,
  } = useSaves({
    cardId: card.id,
    targetType: "card",
    initialSaves: card.metadata?.saves || 0,
    initialSaved: false,
  });

  const {
    upvotes,
    voted,
    isLoading: isVoting,
    toggleVote,
  } = useVotes({
    targetType: "card",
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

  const canEdit =
    user &&
    ((id && (user.id === ownerId || user.id === addedBy)) ||
      (!id && card.created_by && user.id === card.created_by));

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = () => {
    setIsDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      let url = `/api/cards/${card.id}`;
      if (id) {
        const queryParam = collectionId
          ? `collection_id=${collectionId}`
          : stackId
          ? `stack_id=${stackId}`
          : "";
        if (queryParam) {
          url += `?${queryParam}`;
        }
      }

      const response = await fetch(url, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete card");
      }

      showSuccess(
        id
          ? "Card removed from collection successfully"
          : "Card deleted successfully"
      );
      window.location.reload();
    } catch (error: any) {
      console.error("Error deleting card:", error);
      showError(error.message || "Failed to delete card");
      setIsDeleting(false);
    }
  };

  const displayTitle = card.title || card.canonical_url;
  const displayDomain =
    card.domain ||
    (card.canonical_url ? new URL(card.canonical_url).hostname : "");

  const placeholderUrl = useMemo(
    () =>
      generatePlaceholderImage(
        imageHeight * 1.33,
        imageHeight,
        displayTitle.substring(0, 15) || "Card"
      ),
    [imageHeight, displayTitle]
  );

  const [imageUrl, setImageUrl] = useState<string>(
    () => card.thumbnail_url || placeholderUrl
  );
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (card.thumbnail_url) {
      setImageUrl(card.thumbnail_url);
      setImageError(false);
    } else {
      setImageUrl(placeholderUrl);
    }
  }, [card.thumbnail_url, placeholderUrl]);

  useEffect(() => {
    if (
      !card.thumbnail_url &&
      card.canonical_url &&
      !imageError &&
      imageUrl === placeholderUrl
    ) {
      const controller = new AbortController();
      let timeoutId: NodeJS.Timeout;

      timeoutId = setTimeout(() => {
        fetch(`/api/cards/metadata`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: card.canonical_url }),
          signal: controller.signal,
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.thumbnail_url) {
              setImageUrl(data.thumbnail_url);
            }
          })
          .catch((err) => {
            if (err.name !== "AbortError") {
              setImageError(true);
            }
          });
      }, 3000);

      return () => {
        clearTimeout(timeoutId);
        controller.abort();
      };
    }
  }, [
    card.thumbnail_url,
    card.canonical_url,
    imageError,
    imageUrl,
    placeholderUrl,
  ]);

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (navigator.share) {
      navigator
        .share({
          title: card.title || "Check this out",
          text: card.description || "",
          url: `${window.location.origin}/card/${card.id}`,
        })
        .catch(() => {});
    } else {
      navigator.clipboard
        .writeText(`${window.location.origin}/card/${card.id}`)
        .then(() => {
          showSuccess("Link copied to clipboard!");
        })
        .catch(() => {
          showError("Failed to copy link");
        });
    }
  };

  const externalUrl =
    (card.metadata as any)?.affiliate_url || card.canonical_url;

  return (
    <>
      <div
        className="relative h-full group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Card
          hover={false}
          className="relative overflow-hidden h-full flex flex-col bg-white rounded-card border border-gray-light shadow-card hover:shadow-cardHover transition-all duration-300"
        >
          {/* Overlay Link: Covers the whole card to make it clickable 
                z-10 ensures it's above basic content but below interactive buttons (z-20)
            */}
          <Link
            href={`/card/${card.id}`}
            className="absolute inset-0 z-10"
            aria-label={`View ${displayTitle}`}
          />

          {/* Image Section */}
          <div
            className="relative w-full bg-gray-light overflow-hidden"
            style={{ height: `${imageHeight}px` }}
          >
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={displayTitle || "Card"}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                unoptimized={imageUrl.startsWith("data:")}
                loading="lazy"
                priority={false}
                onError={() => {
                  if (!imageError && !imageUrl.startsWith("data:")) {
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

            {card.domain && (
              <div className="absolute top-3 left-3 z-20 pointer-events-none">
                <span className="px-2 py-1 bg-white/90 backdrop-blur-sm rounded-md text-xs font-medium text-jet-dark">
                  {card.domain}
                </span>
              </div>
            )}

            {!hideHoverButtons && (
              <div
                className={`absolute top-3 right-3 z-20 flex gap-2 transition-opacity duration-200 ${
                  isHovered ? "opacity-100" : "opacity-0"
                }`}
              >
                <button
                  onClick={handleShare}
                  className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                  aria-label="Share"
                >
                  <svg
                    className="w-4 h-4 text-jet-dark"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                </button>

                {/* External Link Button */}
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                  onClick={(e) => e.stopPropagation()}
                  title="Open Link"
                >
                  <svg
                    className="w-4 h-4 text-jet-dark"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>

                {canEdit && (
                  <div className="relative">
                    <Dropdown
                      items={[
                        {
                          label: "Edit",
                          onClick: handleEdit,
                          icon: (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          ),
                        },
                        {
                          label: "Delete",
                          onClick: handleDeleteClick,
                          variant: "danger",
                          icon: (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          ),
                        },
                      ]}
                      className="w-8 h-8"
                    >
                      <div className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm pointer-events-none">
                        <svg
                          className="w-4 h-4 text-jet-dark"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                          />
                        </svg>
                      </div>
                    </Dropdown>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions (Save/Vote) */}
            {!hideHoverButtons && (
              <div
                className={`absolute bottom-3 left-3 z-20 flex items-center gap-3 transition-opacity duration-200 ${
                  isHovered ? "opacity-100" : "opacity-0"
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
                    className={`w-4 h-4 ${
                      voted ? "fill-red-500 text-red-500" : "text-jet-dark"
                    }`}
                    fill={voted ? "currentColor" : "none"}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
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
                    isSaved ? "text-emerald" : ""
                  }`}
                >
                  <svg
                    className={`w-4 h-4 ${
                      isSaved ? "fill-emerald text-emerald" : "text-jet-dark"
                    }`}
                    fill={isSaved ? "currentColor" : "none"}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                    />
                  </svg>
                  <span>{saveCount}</span>
                </button>
              </div>
            )}

            {!hideHoverButtons && user && (
              <div
                className={`absolute bottom-3 right-3 z-20 transition-opacity duration-200 ${
                  isHovered ? "opacity-100" : "opacity-0"
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
                      ${
                        isSaved
                          ? "bg-emerald text-white hover:bg-emerald-dark"
                          : "bg-emerald text-white hover:bg-emerald-dark"
                      }
                      ${isAnimating ? "animate-pulse scale-110" : ""}
                    `}
                >
                  {isSaved ? "Saved" : "Save"}
                </button>
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="p-4 flex-1 flex flex-col relative pointer-events-none">
            {/* Title */}
            {card.title && (
              <h3 className="text-lg font-bold text-jet-dark mb-2 line-clamp-2">
                {card.title}
              </h3>
            )}

            {/* Link and Creator */}
            <div className="mt-auto pt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <svg
                  className="w-4 h-4 text-gray-muted flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                <span className="text-sm text-gray-muted truncate">
                  {displayDomain}
                </span>
              </div>

              {/* Creator Name Link - Add this inside the Content Section div */}
              {card.creator?.display_name && (
                <div
                  className="mt-auto pt-2 flex justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link
                    href={`/profile/${card.creator.username}`}
                    className="text-xs text-gray-400 hover:text-emerald hover:underline transition-colors"
                    title={`Created by ${card.creator.display_name}`}
                  >
                    By {card.creator.display_name}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </Card>
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

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title={id ? "Remove Card from Collection" : "Delete Card"}
        message={
          id
            ? "Are you sure you want to remove this card from the collection? This action cannot be undone."
            : "Are you sure you want to delete this card permanently? This action cannot be undone."
        }
        confirmText={id ? "Remove" : "Delete"}
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
}
