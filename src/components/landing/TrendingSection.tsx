'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { FeedGrid } from '@/components/feed/FeedGrid';

interface TrendingSectionProps {
  collections: any[];
  cards: any[];
}

export function TrendingSection({ collections, cards }: TrendingSectionProps) {
  // Limit to 4 collections and 4 cards (total 8 items)
  const limitedCollections = collections.slice(0, 4);
  const limitedCards = cards.slice(0, 4);
  
  // Combine collections and cards for display
  const trendingItems = [
    ...limitedCollections.map(c => ({ type: 'collection' as const, ...c })),
    ...limitedCards.map(c => ({ type: 'card' as const, ...c })),
  ];

  return (
    <section className="container mx-auto px-4 md:px-page py-12 md:py-16 lg:py-20 xl:py-24 bg-gradient-to-b from-white to-cloud">
      <motion.div 
        className="mb-8 md:mb-12 lg:mb-16 text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-jet-dark mb-3 md:mb-4">
          Trending on Stacq
        </h2>
        <p className="text-base sm:text-lg md:text-xl text-gray-muted max-w-2xl mx-auto mb-3 md:mb-4 px-2">
          See what the community is curating right now.
        </p>
        <div className="w-12 md:w-16 h-1 bg-emerald mx-auto rounded-full"></div>
      </motion.div>

      {/* Categories */}
      <div className="mb-6 md:mb-8 lg:mb-12">
        <div className="flex flex-wrap justify-center gap-3 md:gap-4 lg:gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="px-3 py-1.5 md:px-4 md:py-2 bg-emerald/10 text-emerald rounded-lg font-medium text-sm md:text-base"
          >
            Trending Collections ({limitedCollections.length})
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="px-3 py-1.5 md:px-4 md:py-2 bg-emerald/10 text-emerald rounded-lg font-medium text-sm md:text-base"
          >
            Trending Cards ({limitedCards.length})
          </motion.div>
        </div>
      </div>

      {/* Grid */}
      {trendingItems.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <FeedGrid items={trendingItems} />
        </motion.div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-muted text-lg">No trending items yet. Be the first to create!</p>
        </div>
      )}

      {/* CTA Button */}
      <motion.div 
        className="text-center mt-8 md:mt-12 lg:mt-16"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <Link href="/explore">
          <Button variant="primary" size="lg" className="w-full sm:w-auto">
            Explore all trending
          </Button>
        </Link>
      </motion.div>
    </section>
  );
}

