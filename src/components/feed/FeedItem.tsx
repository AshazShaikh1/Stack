'use client';

import Image from 'next/image';
import Link from 'next/link';
import { StackCard } from '@/components/stack/StackCard';
import { CardPreview } from '@/components/card/CardPreview';

interface Attribution {
  id: string;
  user_id: string;
  source: string;
  stack_id?: string;
  created_at: string;
  user?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface FeedItemProps {
  item: {
    type: 'card' | 'stack';
    id: string;
    title?: string;
    description?: string;
    thumbnail_url?: string;
    canonical_url?: string;
    domain?: string;
    cover_image_url?: string;
    slug?: string;
    is_public?: boolean;
    stats?: any;
    owner_id?: string;
    created_at?: string;
    owner?: {
      id: string;
      username: string;
      display_name: string;
      avatar_url?: string;
    };
    creator?: {
      id: string;
      username: string;
      display_name: string;
      avatar_url?: string;
    };
    attributions?: Attribution[];
  };
}

export function FeedItem({ item }: FeedItemProps) {
  if (item.type === 'stack') {
    return <StackCard stack={item as any} />;
  }

  // Card item
  const card = item;
  const attributions = card.attributions || [];
  const uniqueAttributions = attributions.slice(0, 3); // Show first 3
  const remainingCount = Math.max(0, attributions.length - 3);

  return (
    <div className="relative group">
      <Link href={card.canonical_url || '#'} target="_blank" rel="noopener noreferrer">
        <div className="bg-white rounded-lg border border-gray-light overflow-hidden hover:shadow-card hover:scale-[1.02] transition-all duration-200">
          {/* Thumbnail */}
          {card.thumbnail_url && (
            <div className="relative w-full aspect-video bg-gray-light">
              <Image
                src={card.thumbnail_url}
                alt={card.title || 'Card'}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              />
            </div>
          )}

          {/* Content */}
          <div className="p-4">
            <h3 className="text-body font-semibold text-jet-dark mb-1 line-clamp-2">
              {card.title || card.canonical_url}
            </h3>
            {card.description && (
              <p className="text-small text-gray-muted line-clamp-2 mb-2">
                {card.description}
              </p>
            )}
            {card.domain && (
              <p className="text-xs text-gray-muted mb-3">{card.domain}</p>
            )}

            {/* Attributions */}
            {attributions.length > 0 && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-light">
                <div className="flex -space-x-2">
                  {uniqueAttributions.map((attr) => (
                    <div
                      key={attr.id}
                      className="w-6 h-6 rounded-full border-2 border-white bg-gray-light flex items-center justify-center text-xs font-semibold text-jet overflow-hidden"
                      title={attr.user?.display_name || 'User'}
                    >
                      {attr.user?.avatar_url ? (
                        <Image
                          src={attr.user.avatar_url}
                          alt={attr.user.display_name}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      ) : (
                        attr.user?.display_name?.charAt(0).toUpperCase() || '?'
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-xs text-gray-muted">
                  {attributions.length === 1
                    ? `Saved by ${attributions[0].user?.display_name || 'someone'}`
                    : `Saved by ${uniqueAttributions[0].user?.display_name || 'someone'}${
                        remainingCount > 0 ? `, +${remainingCount} more` : ''
                      }`}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

