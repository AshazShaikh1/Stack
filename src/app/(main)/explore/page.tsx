import { FeedGrid } from "@/components/feed/FeedGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrendingStacqerCard } from "@/components/explore/TrendingStacqerCard";
import { getExploreFeed } from "@/lib/services/exploreService";
import { generateMetadata } from "@/lib/seo";

export const metadata = generateMetadata({
  title: "Explore Trending Stacks",
  description: "See what the community is curating today. Discover top collections and resources.",
  url: "/explore",
});

export default async function ExplorePage() {
  const { todayTrending, trendingStacqers, weekTrending } =
    await getExploreFeed();

  return (
    <div className="min-h-screen bg-cloud">
      <div className="container mx-auto px-4 md:px-page py-6 md:py-8 lg:py-12">
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-jet-dark mb-2">
            Explore
          </h1>
          <p className="text-base md:text-lg text-gray-muted">
            Discover trending collections, cards, and top creators
          </p>
        </div>

        {/* 1. Today Trending - Top 5 */}
        {todayTrending.length > 0 && (
          <div className="mb-12 md:mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-semibold text-jet-dark">
                Today Trending
              </h2>
              <span className="text-sm text-gray-muted">Top 5</span>
            </div>
            <FeedGrid items={todayTrending} hideHoverButtons={false} />
          </div>
        )}

        {/* 2. Top 3 Trending Stacqers */}
        {trendingStacqers.length > 0 && (
          <div className="mb-12 md:mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-semibold text-jet-dark">
                Top Trending Stacqers
              </h2>
              <span className="text-sm text-gray-muted">Last 3 days</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              {trendingStacqers.map((user: any, index: number) => (
                <TrendingStacqerCard
                  key={user.id}
                  user={user}
                  rank={index + 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* 3. Last Week Trending */}
        {weekTrending.length > 0 && (
          <div className="mb-12 md:mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-semibold text-jet-dark">
                Last Week Trending
              </h2>
            </div>
            <FeedGrid items={weekTrending} hideHoverButtons={false} />
          </div>
        )}

        {/* Empty State */}
        {todayTrending.length === 0 &&
          trendingStacqers.length === 0 &&
          weekTrending.length === 0 && (
            <EmptyState
              icon="📊"
              title="No trending content yet"
              description="Be the first to create and share content with the community"
              action={{
                label: "Create Collection",
                href: "/",
              }}
            />
          )}
      </div>
    </div>
  );
}
