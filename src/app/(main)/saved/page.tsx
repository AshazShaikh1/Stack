import { getSavedFeed } from "@/lib/services/feedService";
import { FeedGrid } from "@/components/feed/FeedGrid";
import { EmptySavedCollectionsState } from "@/components/ui/EmptyState";
import { SavedCollectionsClient } from "./SavedCollectionsClient";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { CollectionGridSkeleton } from "@/components/ui/Skeleton";
import { generateMetadata } from "@/lib/seo";

export const metadata = generateMetadata({
  title: "My Saved Items",
  noIndex: true, // <--- Enforced (User specific data)
});

// The data fetching component
async function SavedFeed({
  filter = "all",
  userId,
}: {
  filter: string;
  userId: string;
}) {
  const items = await getSavedFeed(userId, filter as any);

  if (items.length === 0) {
    return <EmptySavedCollectionsState />;
  }

  return <FeedGrid items={items} />;
}

// The main page component
export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { filter = "all" } = await searchParams;
  const activeFilter =
    filter === "collection" || filter === "card" ? filter : "all";

  return (
    <div className="container mx-auto px-page py-section">
      <div className="mb-8">
        <h1 className="text-h1 font-bold text-jet-dark mb-2">Saved Items</h1>
        <p className="text-body text-gray-muted mb-6">
          All the collections and cards you&apos;ve saved for later
        </p>

        {/* Filter Tabs */}
        <div className="border-b border-gray-light">
          <div className="flex gap-8">
            <Link
              href="/saved?filter=all"
              className={`
                pb-4 px-1 border-b-2 transition-colors
                ${
                  activeFilter === "all"
                    ? "border-jet text-jet-dark font-semibold"
                    : "border-transparent text-gray-muted hover:text-jet-dark"
                }
              `}
            >
              All
            </Link>
            <Link
              href="/saved?filter=collection"
              className={`
                pb-4 px-1 border-b-2 transition-colors
                ${
                  activeFilter === "collection"
                    ? "border-jet text-jet-dark font-semibold"
                    : "border-transparent text-gray-muted hover:text-jet-dark"
                }
              `}
            >
              Collection
            </Link>
            <Link
              href="/saved?filter=card"
              className={`
                pb-4 px-1 border-b-2 transition-colors
                ${
                  activeFilter === "card"
                    ? "border-jet text-jet-dark font-semibold"
                    : "border-transparent text-gray-muted hover:text-jet-dark"
                }
              `}
            >
              Card
            </Link>
          </div>
        </div>
      </div>

      <SavedCollectionsClient />

      <Suspense fallback={<CollectionGridSkeleton />}>
        <SavedFeed filter={activeFilter} userId={user.id} />
      </Suspense>
    </div>
  );
}
