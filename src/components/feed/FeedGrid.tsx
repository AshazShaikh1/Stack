import { FeedItem } from "./FeedItem";
import { CollectionGridSkeleton } from "@/components/ui/Skeleton";
import { EmptyStacksState } from "@/components/ui/EmptyState";

export interface FeedGridItem {
  type: "card" | "collection";
  id: string;
  [key: string]: any;
}

interface FeedGridProps {
  items?: FeedGridItem[];
  collections?: any[]; // legacy
  isLoading?: boolean;
  onCreateCollection?: () => void;
  hideHoverButtons?: boolean;
}

export function FeedGrid({
  items,
  collections,
  isLoading,
  onCreateCollection,
  hideHoverButtons = false,
}: FeedGridProps) {
  /* 1. Loading */
  if (isLoading) {
    return <CollectionGridSkeleton count={8} />;
  }

  /* 2. Normalize data (WITHOUT lying about types) */
  const feedItems: FeedGridItem[] =
    items ??
    (collections
      ? collections.map((c) => ({
          ...c,
          type: "collection" as const,
        }))
      : []);

  /* 3. Empty state */
  if (feedItems.length === 0) {
    return <EmptyStacksState onCreateStack={onCreateCollection} />;
  }

  /* 4. Responsive Grid (from v2, safe) */
  return (
    <div
      className="
        grid
        grid-cols-1
        sm:grid-cols-2
        lg:grid-cols-3
        xl:grid-cols-4
        gap-4
        md:gap-6
        pb-24
        md:pb-8
      "
    >
      {feedItems.map((item) => (
        <FeedItem
          key={`${item.type}-${item.id}`}
          item={item}
          hideHoverButtons={hideHoverButtons}
        />
      ))}
    </div>
  );
}
