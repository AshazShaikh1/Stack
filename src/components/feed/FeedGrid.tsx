'use client';

import { StackCard } from '@/components/stack/StackCard';

interface Stack {
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
}

interface FeedGridProps {
  stacks: Stack[];
  isLoading?: boolean;
}

export function FeedGrid({ stacks, isLoading }: FeedGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-gray-light animate-pulse"
          >
            <div className="w-full h-48 bg-gray-light rounded-t-card" />
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-light rounded w-3/4" />
              <div className="h-3 bg-gray-light rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (stacks.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">📌</div>
        <h3 className="text-h2 font-semibold text-jet-dark mb-2">
          No stacks yet
        </h3>
        <p className="text-body text-gray-muted mb-6">
          Start by creating your first stack or explore what others have shared
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {stacks.map((stack) => (
        <StackCard key={stack.id} stack={stack} />
      ))}
    </div>
  );
}

