import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { ExpandableDescription } from "@/components/card/ExpandableDescription";
import { CreatorInfo } from "@/components/card/CreatorInfo";
import { CardPreview } from "@/components/card/CardPreview";
import { CardActionsBar } from "@/components/card/CardActionsBar";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CommentSkeleton } from "@/components/ui/Skeleton";

interface CardPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: card } = await supabase
    .from("cards")
    .select("title, description, thumbnail_url, created_by")
    .eq("id", id)
    .single();

  if (!card) {
    return generateSEOMetadata({ title: "Card Not Found", noIndex: true });
  }

  return generateSEOMetadata({
    title: card.title,
    description: card.description || "View this resource on Stacq",
    image: card.thumbnail_url,
    url: `/card/${id}`,
    type: "article",
  });
}

export default async function CardPage({ params }: CardPageProps) {
  try {
    const { id } = await params;
    if (!id) notFound();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: card, error } = await supabase
      .from("cards")
      .select(
        `
        *,
        creator:users!cards_created_by_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !card) {
      notFound();
    }

    const { data: relatedCards } = await supabase
      .from("cards")
      .select(
        `
        id, title, description, thumbnail_url, canonical_url, domain,
        upvotes_count, saves_count, created_by,
        creator:users!cards_created_by_fkey(username, display_name, avatar_url)
      `
      )
      .eq("status", "active")
      .neq("id", id)
      .or(`domain.eq.${card.domain},created_by.eq.${card.created_by}`)
      .limit(4);

    const targetUrl =
      (card.metadata as any)?.affiliate_url || card.canonical_url || "#";
    const domain =
      card.domain ||
      (card.canonical_url ? new URL(card.canonical_url).hostname : "stacq.app");

    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 md:px-page py-6 md:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-xl border border-gray-light shadow-sm overflow-hidden">
                <div className="p-4 md:p-6 border-b border-gray-light">
                  <h1 className="text-xl md:text-3xl font-bold text-jet-dark mb-2 leading-tight">
                    {card.title}
                  </h1>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <a
                      href={targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-emerald-600 transition-colors flex items-center gap-1 font-medium"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                      {domain}
                    </a>
                  </div>
                </div>

                <div className="relative w-full bg-gray-50 group border-b border-gray-light aspect-video">
                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full h-full relative"
                  >
                    {card.thumbnail_url ? (
                      <Image
                        src={card.thumbnail_url}
                        alt={card.title || "Card Image"}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        priority
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 800px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-100">
                        <span className="text-4xl md:text-6xl">🔗</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="bg-white/90 backdrop-blur px-4 py-2 rounded-full text-sm font-semibold shadow-lg flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-all">
                        Visit Website
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14 5l7 7m0 0l-7 7m7-7H3"
                          />
                        </svg>
                      </span>
                    </div>
                  </a>
                </div>

                <div className="p-4 md:px-6 md:pb-6">
                  <div className="mb-6">
                    <CardActionsBar
                      cardId={card.id}
                      initialUpvotes={card.upvotes_count || 0}
                      initialSaves={card.saves_count || 0}
                      shareUrl={`${
                        process.env.NEXT_PUBLIC_APP_URL || "https://stacq.app"
                      }/card/${card.id}`}
                      title={card.title || "Check this resource on Stacq"}
                    />
                  </div>

                  {card.creator && (
                    <div className="mb-6">
                      <CreatorInfo creator={card.creator} />
                    </div>
                  )}

                  <ExpandableDescription description={card.description} />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-light shadow-sm p-4 md:p-6">
                <Suspense
                  fallback={
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <CommentSkeleton key={i} />
                      ))}
                    </div>
                  }
                >
                  <CommentsSection targetType="card" targetId={id} />
                </Suspense>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-4 md:space-y-6">
              <h3 className="text-lg md:text-xl font-bold text-jet-dark px-1">
                Related Resources
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                {relatedCards && relatedCards.length > 0 ? (
                  relatedCards.map((relatedCard: any) => (
                    <div key={relatedCard.id} className="h-auto">
                      <CardPreview
                        card={{
                          ...relatedCard,
                          type: "card",
                        }}
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
      </div>
    );
  } catch (error) {
    notFound();
  }
}
