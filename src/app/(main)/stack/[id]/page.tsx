import { createClient } from '@/lib/supabase/server';
import { StackHeader } from '@/components/stack/StackHeader';
import { CardPreview } from '@/components/card/CardPreview';
import { AddCardButton } from '@/components/card/AddCardButton';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { notFound } from 'next/navigation';

interface StackPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function StackPage({ params }: StackPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get stack with owner and tags
  const { data: stack, error: stackError } = await supabase
    .from('stacks')
    .select(`
      id,
      title,
      description,
      cover_image_url,
      owner_id,
      stats,
      is_public,
      is_hidden,
      owner:users!stacks_owner_id_fkey (
        username,
        display_name,
        avatar_url
      ),
      tags:stack_tags (
        tag:tags (
          id,
          name
        )
      )
    `)
    .eq('id', id)
    .single();

  if (stackError || !stack) {
    notFound();
  }

  // Check if user can view this stack
  const canView = stack.is_public || 
                  stack.owner_id === user?.id || 
                  (stack.is_hidden && stack.owner_id === user?.id);

  if (!canView) {
    notFound();
  }

  const isOwner = stack.owner_id === user?.id;

  // Transform tags
  const transformedTags = stack.tags?.map((st: any) => st.tag).filter(Boolean) || [];

  // Get cards in this stack
  const { data: stackCards, error: cardsError } = await supabase
    .from('stack_cards')
    .select(`
      card:cards (
        id,
        title,
        description,
        thumbnail_url,
        canonical_url,
        domain
      )
    `)
    .eq('stack_id', stack.id)
    .order('added_at', { ascending: false });

  if (cardsError) {
    console.error('Error fetching cards:', cardsError);
  }

  const cards = stackCards?.map((sc: any) => sc.card).filter(Boolean) || [];

  return (
    <div className="container mx-auto px-page py-section">
      <StackHeader 
        stack={{
          ...stack,
          tags: transformedTags,
        }}
        isOwner={isOwner}
      />

      {/* Cards Grid */}
      {cards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.map((card: any) => (
            <CardPreview key={card.id} card={card} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📎</div>
          <h3 className="text-h2 font-semibold text-jet-dark mb-2">
            No cards yet
          </h3>
          <p className="text-body text-gray-muted mb-6">
            {isOwner 
              ? 'Start adding cards to your stack to share resources with others'
              : 'This stack doesn\'t have any cards yet'
            }
          </p>
          {isOwner && (
            <AddCardButton stackId={stack.id} />
          )}
        </div>
      )}

      {/* Comments Section */}
      <CommentsSection targetType="stack" targetId={stack.id} />
    </div>
  );
}

