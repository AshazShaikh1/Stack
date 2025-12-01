'use client';

import { useEffect, useState } from 'react';
import { FeedGrid } from '@/components/feed/FeedGrid';
import { StackGridSkeleton } from '@/components/ui/Skeleton';

export function HomeFeed() {
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    setIsLoading(true);
    try {
      // Use the feed API endpoint with the new ranking algorithm
      const response = await fetch('/api/feed?type=both&limit=50');
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

  if (isLoading) {
    return <StackGridSkeleton count={12} />;
  }

  return <FeedGrid items={feedItems} />;
}

