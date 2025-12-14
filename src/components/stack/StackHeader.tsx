"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EditCollectionModal } from "./EditStackModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useVotes } from "@/hooks/useVotes";
import { useSaves } from "@/hooks/useSaves";
import { ReportButton } from "@/components/report/ReportButton";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/contexts/ToastContext";

interface StackHeaderProps {
  stack: {
    id: string;
    title: string;
    description?: string;
    cover_image_url?: string;
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
    tags?: Array<{
      id: string;
      name: string;
    }>;
    is_public?: boolean;
    is_hidden?: boolean;
  };
  isOwner?: boolean;
}

export function StackHeader({ stack, isOwner = false }: StackHeaderProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const {
    upvotes,
    voted,
    isLoading: isVoteLoading,
    error: voteError,
    toggleVote,
  } = useVotes({
    targetType: "stack", // Note: 'stack' might need to be 'collection' in DB
    targetId: stack.id,
    initialUpvotes: stack.stats.upvotes || 0,
    initialVoted: false,
  });

  const {
    saves: saveCount,
    saved: isSaved,
    isLoading: isSaveLoading,
    toggleSave,
  } = useSaves({
    stackId: stack.id,
    initialSaves: stack.stats.saves || 0,
    initialSaved: false,
  });

  const [user, setUser] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: stack.title,
          text: stack.description,
          url: window.location.href,
        });
      } catch (err) {}
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        showSuccess("Link copied to clipboard!");
      } catch (err) {
        showError("Failed to copy link");
      }
    }
  };

  const handleClone = async () => {
    if (!user) return showError("Please sign in to clone");
    if (isOwner) return showError("Cannot clone your own collection");

    try {
      const response = await fetch(`/api/stacks/${stack.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to clone");

      if (data.stack?.id) {
        trackEvent.cloneStack(user.id, stack.id, data.stack.id);
        showSuccess("Cloned successfully!");
        window.location.href = `/stack/${data.stack.id}`;
      }
    } catch (error: any) {
      showError(error.message || "Failed to clone");
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/stacks/${stack.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");

      showSuccess("Deleted successfully");
      router.push("/");
    } catch (error: any) {
      showError(error.message || "Failed to delete");
    } finally {
      setIsDeleteConfirmOpen(false);
    }
  };

  return (
    <div className="mb-8">
      {/* Top Section: Stacked on Mobile, Row on Desktop */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Cover Image */}
        <div className="w-full md:w-64 md:h-48 aspect-video md:aspect-auto relative rounded-xl overflow-hidden shadow-sm bg-gray-100 flex-shrink-0">
          {stack.cover_image_url ? (
            <Image
              src={stack.cover_image_url}
              alt={stack.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 300px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 text-5xl">
              📚
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1">
            <h1 className="text-2xl md:text-4xl font-bold text-jet-dark mb-3 leading-tight">
              {stack.title}
            </h1>

            {/* Owner & Tags */}
            <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
              {stack.owner && (
                <Link
                  href={`/profile/${stack.owner.username}`}
                  className="inline-flex items-center gap-2 text-gray-600 hover:text-emerald-600 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden relative border border-gray-100">
                    {stack.owner.avatar_url ? (
                      <Image
                        src={stack.owner.avatar_url}
                        alt={stack.owner.username}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-emerald-600 text-white text-[8px] font-bold">
                        {stack.owner.display_name?.[0]}
                      </div>
                    )}
                  </div>
                  <span className="font-medium">
                    {stack.owner.display_name}
                  </span>
                </Link>
              )}

              {stack.tags?.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/explore?tag=${tag.name}`}
                  className="px-2.5 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>

            {stack.description && (
              <p className="text-gray-600 text-sm md:text-base leading-relaxed max-w-3xl mb-6">
                {stack.description}
              </p>
            )}

            {/* Actions Row */}
            <div className="flex flex-wrap gap-2 md:gap-3">
              <Button
                variant={voted ? "primary" : "outline"}
                size="sm"
                onClick={toggleVote}
                disabled={isVoteLoading}
                className={voted ? "bg-emerald-600 border-emerald-600" : ""}
              >
                <span className="mr-1.5">👍</span> {upvotes}
              </Button>

              <Button
                variant={isSaved ? "primary" : "outline"}
                size="sm"
                onClick={toggleSave}
                disabled={isSaveLoading}
                className={isSaved ? "bg-emerald-600 border-emerald-600" : ""}
              >
                <span className="mr-1.5">💾</span> {saveCount}
              </Button>

              <Button variant="outline" size="sm" onClick={handleShare}>
                Share
              </Button>

              {isOwner ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="text-red-600 hover:border-red-600 hover:bg-red-50"
                  >
                    Delete
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClone}
                    disabled={!user}
                  >
                    Clone
                  </Button>
                  <ReportButton
                    targetType="stack"
                    targetId={stack.id}
                    variant="outline"
                    size="sm"
                  />
                </>
              )}
            </div>
            {voteError && (
              <p className="text-xs text-red-500 mt-2">{voteError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Bar - Scrollable on Mobile */}
      <div className="border-t border-b border-gray-100 py-3 md:py-4">
        <div className="flex md:gap-12 justify-around md:justify-start overflow-x-auto no-scrollbar">
          <div className="flex flex-col items-center md:items-start min-w-[60px]">
            <span className="text-lg md:text-xl font-bold text-jet-dark">
              {stack.stats.views || 0}
            </span>
            <span className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">
              Views
            </span>
          </div>
          <div className="flex flex-col items-center md:items-start min-w-[60px]">
            <span className="text-lg md:text-xl font-bold text-jet-dark">
              {stack.stats.comments || 0}
            </span>
            <span className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">
              Comments
            </span>
          </div>
          <div className="flex flex-col items-center md:items-start min-w-[60px]">
            <span className="text-lg md:text-xl font-bold text-jet-dark">
              {upvotes}
            </span>
            <span className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">
              Upvotes
            </span>
          </div>
          <div className="flex flex-col items-center md:items-start min-w-[60px]">
            <span className="text-lg md:text-xl font-bold text-jet-dark">
              {saveCount}
            </span>
            <span className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">
              Saves
            </span>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isEditModalOpen && (
        <EditCollectionModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          stack={{
            id: stack.id,
            title: stack.title,
            description: stack.description,
            cover_image_url: stack.cover_image_url,
            is_public: stack.is_public ?? true,
            is_hidden: stack.is_hidden ?? false,
            tags: stack.tags || [],
          }}
        />
      )}

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Stack"
        message="Are you sure? This cannot be undone."
        confirmText="Delete"
        variant="danger"
        cancelText="Cancel"
      />
    </div>
  );
}
