'use client';

import { useState } from 'react';
import { FeedGrid } from '@/components/feed/FeedGrid';
import { CollectionGridSkeleton } from '@/components/ui/Skeleton';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr/fetcher';

export function FeedPage() {
  const [filter, setFilter] = useState<'both' | 'card' | 'collection'>('both');
  
  // Use SWR for client-side caching with automatic revalidation
  const { data, error, isLoading } = useSWR(
    `/api/feed?type=${filter}&limit=50`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      refreshInterval: 0,
    }
  );

  const feedItems = data?.feed || [];

  return (
    <div className="min-h-screen bg-cloud">
      <div className="container mx-auto px-4 md:px-page py-6 md:py-8 lg:py-12">
        <div className="mb-8 md:mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-jet-dark mb-2">
                Your Feed
              </h1>
              <p className="text-base md:text-lg text-gray-muted">
                Discover curated resources from the community
              </p>
            </div>

            {/* Filter Toggle */}
            <div className="flex gap-2 bg-gray-light rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setFilter('both')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  filter === 'both'
                    ? 'bg-emerald text-white shadow-button'
                    : 'text-gray-muted hover:text-emerald hover:bg-emerald/10'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('card')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  filter === 'card'
                    ? 'bg-emerald text-white shadow-button'
                    : 'text-gray-muted hover:text-emerald hover:bg-emerald/10'
                }`}
              >
                Cards
              </button>
              <button
                onClick={() => setFilter('collection')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  filter === 'collection'
                    ? 'bg-emerald text-white shadow-button'
                    : 'text-gray-muted hover:text-emerald hover:bg-emerald/10'
                }`}
              >
                Collections
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <CollectionGridSkeleton count={12} />
        ) : error ? (
          <div className="text-center py-12">
            <div className="inline-block px-6 py-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 font-medium">Error loading feed</p>
              <p className="text-sm text-red-500 mt-1">Please try again later</p>
            </div>
          </div>
        ) : feedItems.length === 0 ? (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-emerald/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-jet-dark mb-2">No items in your feed</h3>
              <p className="text-gray-muted mb-6">
                Start following collections and creators to see their content here
              </p>
            </div>
          </div>
        ) : (
          <FeedGrid items={feedItems} />
        )}
      </div>
    </div>
  );
}

