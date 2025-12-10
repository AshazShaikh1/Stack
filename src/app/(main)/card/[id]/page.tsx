import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { CardPreview } from '@/components/card/CardPreview';
import { CardActionsBar } from '@/components/card/CardActionsBar';
import { ExpandableDescription } from '@/components/card/ExpandableDescription';
import { generateMetadata as generateSEOMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import { getCacheKey, CACHE_TTL } from '@/lib/cache/supabase-cache';
import { cached } from '@/lib/redis';

interface CardPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CardPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: card } = await supabase
    .from('cards')
    .select('title, description, thumbnail_url')
    .eq('id', id)
    .single();

  if (!card) return {};

  return generateSEOMetadata({
    title: card.title || 'Resource',
    description: card.description || `View resource on Stacq`,
    image: card.thumbnail_url || undefined,
    url: `/card/${id}`,
    type: 'article',
  });
}

export default async function CardPage({ params }: CardPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Fetch Main Card Details
  const { data: card, error } = await supabase
    .from('cards')
    .select(`
      *,
      creator:users!cards_created_by_fkey (
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('id', id)
    .single();

  if (error || !card) {
    notFound();
  }

  // 2. Fetch Related Cards
  const relatedCardsResult = await cached(
    getCacheKey('related-cards', { cardId: id, domain: card.domain }),
    async () => {
      // Try to find cards with same domain first
      const { data: related } = await supabase
        .from('cards')
        .select(`
          id, title, description, thumbnail_url, canonical_url, domain,
          upvotes_count, saves_count, created_by,
          creator:users!cards_created_by_fkey(username, display_name)
        `)
        .eq('status', 'active')
        .eq('is_public', true)
        .neq('id', id)
        .eq('domain', card.domain)
        .limit(6);
      
      // Fallback to recent public cards if not enough domain matches
      if (!related || related.length < 3) {
        const { data: recent } = await supabase
          .from('cards')
          .select(`
            id, title, description, thumbnail_url, canonical_url, domain,
            upvotes_count, saves_count, created_by,
            creator:users!cards_created_by_fkey(username, display_name)
          `)
          .eq('status', 'active')
          .eq('is_public', true)
          .neq('id', id)
          .limit(6 - (related?.length || 0));
          
        return [...(related || []), ...(recent || [])];
      }
      return related;
    },
    CACHE_TTL.FEED
  );

  const relatedCards = relatedCardsResult || [];
  const targetUrl = (card.metadata as any)?.affiliate_url || card.canonical_url;
  const domain = card.domain || new URL(card.canonical_url).hostname;

  return (
    <div className="container mx-auto px-4 md:px-page py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Main Content (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-xl border border-gray-light shadow-sm overflow-hidden">
            
            {/* 1. Header Info */}
            <div className="p-6 border-b border-gray-light">
              <h1 className="text-2xl md:text-3xl font-bold text-jet-dark mb-2">
                {card.title}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <a 
                  href={targetUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-emerald transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {domain}
                </a>
                <span>•</span>
                {card.creator && (
                  <Link href={`/profile/${card.creator.username}`} className="hover:underline">
                    Added by {card.creator.display_name}
                  </Link>
                )}
              </div>
            </div>

            {/* 2. Cover Image (Click redirects to link) */}
            <div className="relative w-full bg-gray-50 group border-b border-gray-light">
              <a href={targetUrl} target="_blank" rel="noopener noreferrer" className="block relative aspect-video w-full overflow-hidden">
                {card.thumbnail_url ? (
                  <Image 
                    src={card.thumbnail_url} 
                    alt={card.title || 'Card Image'}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <span className="text-6xl">🔗</span>
                  </div>
                )}
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="bg-white/90 backdrop-blur px-4 py-2 rounded-full text-sm font-semibold shadow-lg flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-all">
                    Visit Website 
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </span>
                </div>
              </a>
            </div>

            <div className="px-6">
              {/* 3. Action Bar (Upvote, Save, Share) */}
              <CardActionsBar 
                cardId={card.id}
                initialUpvotes={card.upvotes_count || 0}
                initialSaves={card.saves_count || 0}
                shareUrl={`${process.env.NEXT_PUBLIC_APP_URL || 'https://stacq.app'}/card/${card.id}`}
                title={card.title || 'Check this resource on Stacq'}
              />

              {/* 4. Description (Read More) */}
              <ExpandableDescription description={card.description} />
            </div>
          </div>

          {/* 5. Comments Section */}
          <div className="bg-white rounded-xl border border-gray-light shadow-sm p-6">
            <CommentsSection targetType="card" targetId={id} />
          </div>
        </div>

        {/* RIGHT COLUMN: Related Content (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <h3 className="text-xl font-bold text-jet-dark">Related Resources</h3>
          <div className="grid grid-cols-1 gap-4">
            {relatedCards.length > 0 ? (
              relatedCards.map((relatedCard: any) => (
                <div key={relatedCard.id} className="h-[320px]"> 
                  <CardPreview 
                    card={relatedCard} 
                    hideHoverButtons={true} 
                  />
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-muted bg-gray-50 rounded-lg border border-dashed border-gray-200">
                No related cards found.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}