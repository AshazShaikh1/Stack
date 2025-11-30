'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { useVotes } from '@/hooks/useVotes';
import { createClient } from '@/lib/supabase/client';

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
  };
  isOwner?: boolean;
}

export function StackHeader({ stack, isOwner = false }: StackHeaderProps) {
  const { upvotes, voted, isLoading, error, toggleVote } = useVotes({
    targetType: 'stack',
    targetId: stack.id,
    initialUpvotes: stack.stats.upvotes || 0,
    initialVoted: false, // Will be fetched by hook
  });

  const [isSaved, setIsSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(stack.stats.saves || 0);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const handleSave = async () => {
    // TODO: Implement save functionality
    alert('Save functionality coming soon!');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: stack.title,
        text: stack.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const handleClone = async () => {
    if (!user) return;
    // TODO: Implement clone functionality
    alert('Clone functionality coming soon!');
  };

  return (
    <div className="mb-8">
      {/* Cover Image */}
      {stack.cover_image_url ? (
        <div className="relative w-full h-96 rounded-card overflow-hidden mb-6">
          <Image
            src={stack.cover_image_url}
            alt={stack.title}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        </div>
      ) : (
        <div className="w-full h-64 bg-gradient-to-br from-jet/10 to-gray-light rounded-card mb-6 flex items-center justify-center">
          <div className="text-6xl">📚</div>
        </div>
      )}

      {/* Title and Description */}
      <div className="mb-6">
        <h1 className="text-h1 font-bold text-jet-dark mb-3">
          {stack.title}
        </h1>
        {stack.description && (
          <p className="text-body text-gray-muted mb-4">
            {stack.description}
          </p>
        )}

        {/* Tags */}
        {stack.tags && stack.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {stack.tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/explore?tag=${tag.name}`}
                className="px-3 py-1 bg-gray-light rounded-full text-small text-jet-dark hover:bg-jet hover:text-white transition-colors"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}

        {/* Owner Info */}
        {stack.owner && (
          <div className="flex items-center gap-3 mb-6">
            {stack.owner.avatar_url ? (
              <Image
                src={stack.owner.avatar_url}
                alt={stack.owner.display_name}
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-jet/20 flex items-center justify-center text-xs font-semibold text-jet">
                {stack.owner.display_name.charAt(0).toUpperCase()}
              </div>
            )}
            <Link
              href={`/profile/${stack.owner.username}`}
              className="text-body text-jet-dark hover:text-jet font-medium"
            >
              {stack.owner.display_name}
            </Link>
            <span className="text-small text-gray-muted">
              @{stack.owner.username}
            </span>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-4 pb-6 border-b border-gray-light">
        <Button
          variant={voted ? 'primary' : 'outline'}
          size="sm"
          onClick={toggleVote}
          disabled={isLoading}
        >
          <span className="mr-2">👍</span>
          {upvotes} {upvotes === 1 ? 'Upvote' : 'Upvotes'}
        </Button>
        {error && (
          <span className="text-small text-red-500 ml-2">{error}</span>
        )}

        <Button
          variant={isSaved ? 'primary' : 'outline'}
          size="sm"
          onClick={handleSave}
          disabled={!user}
        >
          <span className="mr-2">💾</span>
          {saveCount} {saveCount === 1 ? 'Save' : 'Saves'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
        >
          <span className="mr-2">🔗</span>
          Share
        </Button>

        {!isOwner && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClone}
            disabled={!user}
          >
            <span className="mr-2">📋</span>
            Clone
          </Button>
        )}

        {isOwner && (
          <Link href={`/stack/${stack.id}/edit`}>
            <Button variant="outline" size="sm">
              <span className="mr-2">✏️</span>
              Edit
            </Button>
          </Link>
        )}

        {/* Stats */}
        <div className="ml-auto flex items-center gap-6 text-small text-gray-muted">
          <span>{stack.stats.views || 0} views</span>
          <span>{stack.stats.comments || 0} comments</span>
        </div>
      </div>
    </div>
  );
}

