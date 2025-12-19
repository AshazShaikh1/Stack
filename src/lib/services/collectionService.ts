import { createClient } from "@/lib/supabase/server";

export async function getCollectionWithCards(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const query = supabase.from("collections").select(`
      *,
      owner:users!collections_owner_id_fkey ( username, display_name, avatar_url ),
      tags:collection_tags ( tag:tags ( id, name ) )
    `);

  const { data: collection, error } = await (isUUID ? query.eq("id", id) : query.eq("slug", id)).maybeSingle();

  if (error || !collection) return null;

  const isOwner = collection.owner_id === user?.id;
  if (!collection.is_public && !isOwner && !(collection.is_hidden && isOwner)) return null;

  const { data: collectionCards } = await supabase
    .from("collection_cards")
    .select(`
      added_by,
      card:cards (
        id, title, description, thumbnail_url, canonical_url, domain,
        upvotes_count, saves_count, created_by, created_at,
        creator:users!cards_created_by_fkey ( id, username, display_name, avatar_url )
      )
    `)
    .eq("collection_id", collection.id)
    .order("added_at", { ascending: false });

  const cards = (collectionCards || [])
    .map((cc: any) => ({ ...cc.card, addedBy: cc.added_by, type: "card" as const }))
    .filter((c: any) => c && c.id);

  return { collection, cards, isOwner };
}

export async function getUserCollections(userId: string) {
  const supabase = await createClient();
  return await supabase
    .from('collections')
    .select(`
      id, title, description, cover_image_url, owner_id, stats,
      owner:users!collections_owner_id_fkey ( username, display_name, avatar_url )
    `)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
}