import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CollectionHeader } from "@/components/collection/CollectionHeader";
import { FeedGrid } from "@/components/feed/FeedGrid";
import { AddCardButton } from "@/components/card/AddCardButton";
import { EmptyCardsWithAdd } from "@/components/card/EmptyCardsWithAdd";
import { EmptyCardsState } from "@/components/ui/EmptyState";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { Suspense, lazy } from "react";
import { CommentSkeleton } from "@/components/ui/Skeleton";

type Props = {
  params: Promise<{ id: string }>;
};

const CommentsSection = lazy(() =>
  import("@/components/comments/CommentsSection").then((m) => ({
    default: m.CommentsSection,
  }))
);

interface CollectionPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from("collections")
    .select("title, description, cover_image_url, owner:users(display_name)")
    .eq("id", id)
    .single();

  if (!collection) {
    // Use the renamed function
    return generateSEOMetadata({ title: "Collection Not Found", noIndex: true });
  }

  // FIX 2: Supabase joins often return arrays. Access the first item safely.
  // We cast to 'any' to handle the mismatch between inferred types and actual data
  const owner = collection.owner as any;
  const ownerName = Array.isArray(owner) ? owner[0]?.display_name : owner?.display_name;

  return generateSEOMetadata({
    title: collection.title,
    description: collection.description || `Curated collection by ${ownerName}`,
    image: collection.cover_image_url,
    url: `/collection/${id}`,
    type: "article",
    author: ownerName,
  });
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  try {
    const { id } = await params;
    if (!id) notFound();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      );

    const collectionQuery = supabase.from("collections").select(`
        *,
        owner:users!collections_owner_id_fkey (
          username,
          display_name,
          avatar_url
        ),
        tags:collection_tags (
          tag:tags (
            id,
            name
          )
        )
      `);

    const { data: collection, error: collectionError } = await (isUUID
      ? collectionQuery.eq("id", id)
      : collectionQuery.eq("slug", id)
    ).maybeSingle();

    if (collectionError || !collection) {
      notFound();
    }

    const isOwner = collection.owner_id === user?.id;
    const canView =
      collection.is_public || isOwner || (collection.is_hidden && isOwner);

    if (!canView) {
      notFound();
    }

    const { data: collectionCards } = await supabase
      .from("collection_cards")
      .select(
        `
        added_by,
        card:cards (
          id, title, description, thumbnail_url, canonical_url, domain,
          upvotes_count, saves_count, created_by, created_at,
          creator:users!cards_created_by_fkey (
            id, username, display_name, avatar_url
          )
        )
      `
      )
      .eq("collection_id", collection.id)
      .order("added_at", { ascending: false });

    const cards = (collectionCards || [])
      .map((cc: any) => ({
        ...cc.card,
        addedBy: cc.added_by,
        type: "card" as const,
      }))
      .filter((c: any) => c && c.id);

    const owner = Array.isArray(collection.owner)
      ? collection.owner[0]
      : collection.owner;
    const tags = collection.tags?.map((t: any) => t.tag).filter(Boolean) || [];

    const stats = collection.stats || {
      cards_count: cards.length,
      views: 0,
      upvotes: 0,
      saves: 0,
      comments: 0,
    };

    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 md:px-page py-6 md:py-12 pb-24 md:pb-8">
          <CollectionHeader
            collection={{
              ...collection,
              owner: owner || {
                username: "unknown",
                display_name: "Unknown User",
              },
              tags,
              stats,
            }}
            isOwner={isOwner}
          />

          {isOwner && cards.length > 0 && (
            <div className="mb-6 flex justify-end">
              <AddCardButton collectionId={collection.id} />
            </div>
          )}

          {cards.length > 0 ? (
            <FeedGrid items={cards} />
          ) : (
            <div>
              {isOwner ? (
                <EmptyCardsWithAdd collectionId={collection.id} />
              ) : (
                <EmptyCardsState />
              )}
            </div>
          )}

          <Suspense
            fallback={
              <div className="py-8">
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <CommentSkeleton key={i} />
                  ))}
                </div>
              </div>
            }
          >
            <CommentsSection
              targetType="collection"
              targetId={collection.id}
              collectionOwnerId={collection.owner_id}
            />
          </Suspense>
        </div>
      </div>
    );
  } catch (error) {
    notFound();
  }
}

