'use client';

import { FeedItem } from './FeedItem';
import { StackGridSkeleton } from '@/components/ui/Skeleton';
import { EmptyStacksState } from '@/components/ui/EmptyState';

interface FeedItem {
  type: 'card' | 'stack';
  id: string;
  [key: string]: any;
}

interface FeedGridProps {
  items?: FeedItem[];
  stacks?: any[]; // Legacy support
  isLoading?: boolean;
  onCreateStack?: () => void;
}

export function FeedGrid({ items, stacks, isLoading, onCreateStack }: FeedGridProps) {
  if (isLoading) {
    return <StackGridSkeleton count={12} />;
  }

  // Support both new items format and legacy stacks format
  const feedItems = items || (stacks ? stacks.map(s => ({ type: 'stack' as const, ...s })) : []);

  if (feedItems.length === 0) {
    return <EmptyStacksState onCreateStack={onCreateStack} />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {feedItems.map((item) => (
        <FeedItem key={`${item.type}-${item.id}`} item={item} />
      ))}
    </div>
  );
}

