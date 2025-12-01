'use client';

import { useEffect, useState } from 'react';
import { FeedGrid } from '@/components/feed/FeedGrid';
import { StackGridSkeleton } from '@/components/ui/Skeleton';

export default function FeedPage() {
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'both' | 'card' | 'stack'>('both');

  useEffect(() => {
    fetchFeed();
  }, [filter]);

  const fetchFeed = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/feed?type=${filter}&limit=50`);
      const data = await response.json();
      
      if (response.ok) {
        setFeedItems(data.feed || []);
      } else {
        console.error('Error fetching feed:', data.error);
      }
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-page py-section">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-h1 font-bold text-jet-dark mb-2">Your Feed</h1>
            <p className="text-body text-gray-muted">
              Discover curated resources from the community
            </p>
          </div>

          {/* Filter Toggle */}
          <div className="flex gap-2 bg-gray-light rounded-lg p-1">
            <button
              onClick={() => setFilter('both')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === 'both'
                  ? 'bg-white text-jet-dark shadow-sm'
                  : 'text-gray-muted hover:text-jet-dark'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('card')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === 'card'
                  ? 'bg-white text-jet-dark shadow-sm'
                  : 'text-gray-muted hover:text-jet-dark'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setFilter('stack')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === 'stack'
                  ? 'bg-white text-jet-dark shadow-sm'
                  : 'text-gray-muted hover:text-jet-dark'
              }`}
            >
              Stacks
            </button>
          </div>
        </div>
      </div>

      <FeedGrid items={feedItems} isLoading={isLoading} />
    </div>
  );
}

