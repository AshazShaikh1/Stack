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
  try {
    const { id } = await params;
    
    if (!id || id.trim() === '') {
      console.error('Invalid stack ID provided:', id);
      notFound();
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Helper function to check if string is a valid UUID
    const isUUID = (str: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    // Get stack with owner and tags
    // Try by UUID first if it looks like a UUID, otherwise try by slug
    let stack: any = null;
    let stackError: any = null;
    
    if (isUUID(id)) {
      // Try by UUID first
      const result = await supabase
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
          slug,
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
        .maybeSingle();
      
      stack = result.data;
      stackError = result.error;
    }

    // If not found by UUID (or not a UUID), try by slug
    if (!stack && !stackError) {
      const result = await supabase
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
          slug,
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
        .eq('slug', id)
        .maybeSingle();
      
      stack = result.data;
      stackError = result.error;
    }

  if (stackError) {
    // Log detailed error information
    console.error('Error fetching stack:', {
      message: stackError.message,
      details: stackError.details,
      hint: stackError.hint,
      code: stackError.code,
      id: id,
      error: JSON.stringify(stackError, Object.getOwnPropertyNames(stackError)),
    });
    notFound();
  }

  if (!stack) {
    console.error('Stack not found for id/slug:', id);
    notFound();
  }

  // Check if user can view this stack
  const canView = stack.is_public || 
                  stack.owner_id === user?.id || 
                  (stack.is_hidden && stack.owner_id === user?.id);

  if (!canView) {
    console.error('Access denied to stack:', {
      stack_id: stack.id,
      is_public: stack.is_public,
      is_hidden: stack.is_hidden,
      owner_id: stack.owner_id,
      user_id: user?.id,
    });
    notFound();
  }

  const isOwner = stack.owner_id === user?.id;

  // Transform tags
  const transformedTags = stack.tags?.map((st: any) => st.tag).filter(Boolean) || [];

  // Ensure owner is a single object, not an array
  const owner = Array.isArray(stack.owner) ? stack.owner[0] : stack.owner;

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
          owner: owner,
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
  } catch (error) {
    console.error('Unexpected error in StackPage:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    notFound();
  }
}

