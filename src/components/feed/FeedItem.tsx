import { CollectionCard } from "@/components/collection/CollectionCard";
import { CardPreview } from "@/components/card/CardPreview";

interface Attribution {
  id: string;
  user_id: string;
  source: string;
  collection_id?: string;
  created_at: string;
}

interface FeedItemProps {
  item: {
    type: "card" | "collection";
    id: string;
    title?: string;
    description?: string;
    thumbnail_url?: string;
    canonical_url?: string;
    domain?: string;
    cover_image_url?: string;
    stats?: any;
    owner_id?: string;
    owner?: any;
    creator?: any;
    created_by?: string;
    saves_count?: number;
    upvotes_count?: number;
    metadata?: any;
    attributions?: Attribution[];
  };
  hideHoverButtons?: boolean;
}

export function FeedItem({ item, hideHoverButtons = false }: FeedItemProps) {
  /* ================= COLLECTION ================= */
  if (item.type === "collection") {
    return (
      <CollectionCard collection={item as any} hideHoverButtons={hideHoverButtons} />
    );
  }

  /* ================= CARD ================= */
  const metadata = {
    saves: item.saves_count ?? item.metadata?.saves ?? 0,
    upvotes: item.upvotes_count ?? item.metadata?.upvotes ?? 0,
  };

  return (
    <CardPreview
      card={{
        id: item.id,
        title: item.title,
        description: item.description,
        thumbnail_url: item.thumbnail_url,
        canonical_url: item.canonical_url || "#",
        domain: item.domain,
        metadata,
        created_by: item.created_by,
        creator: item.creator,
      }}
      hideHoverButtons={hideHoverButtons}
    />
  );
}
