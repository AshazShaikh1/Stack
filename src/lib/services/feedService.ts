import { createClient } from "@/lib/supabase/server";
import { SELECT_CARD_FULL, SELECT_COLLECTION_FULL } from "@/lib/supabase/queries";

// --- 1. SAVED ITEMS (Used in /saved and Profile "Saved" tab) ---
export async function getSavedFeed(userId: string, type: 'all' | 'card' | 'collection' = 'all') {
  const supabase = await createClient();
  
  // Fetch IDs from saves table
  const { data: saves } = await supabase
    .from("saves")
    .select("target_type, target_id, collection_id, card_id, stack_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!saves?.length) return [];

  const items: any[] = [];

  // Normalize IDs
  const collectionIds = saves
    .filter(s => s.target_type === 'collection' || s.collection_id || s.stack_id)
    .map(s => s.target_id || s.collection_id || s.stack_id);
    
  const cardIds = saves
    .filter(s => s.target_type === 'card' || s.card_id)
    .map(s => s.target_id || s.card_id);

  // Fetch Collections
  if ((type === 'all' || type === 'collection') && collectionIds.length) {
    const { data } = await supabase
      .from("collections")
      .select(SELECT_COLLECTION_FULL)
      .in("id", collectionIds)
      .eq("is_public", true);
      
    data?.forEach(c => items.push({ ...c, type: 'collection' }));
  }

  // Fetch Cards
  if ((type === 'all' || type === 'card') && cardIds.length) {
    const { data } = await supabase
      .from("cards")
      .select(SELECT_CARD_FULL)
      .in("id", cardIds)
      .eq("status", "active");
      
    data?.forEach(c => items.push({ ...c, type: 'card' }));
  }

  // Re-sort by saved order (optional, but nice) or just returned mixed
  return items; // In a real app, you might want to map this back to the original 'saves' order
}

// --- 2. SEARCH (Used in /search) ---
export async function getSearchFeed(query: string) {
  if (!query.trim()) return [];
  const supabase = await createClient();
  const cleanQuery = query.trim();
  const items: any[] = [];

  // Search Collections
  const { data: collections } = await supabase
    .from("collections")
    .select(SELECT_COLLECTION_FULL)
    .eq("is_public", true)
    .eq("is_hidden", false)
    .or(`title.ilike.%${cleanQuery}%,description.ilike.%${cleanQuery}%`)
    .limit(20);

  // Search Cards
  const { data: cards } = await supabase
    .from("cards")
    .select(SELECT_CARD_FULL)
    .eq("status", "active")
    .or(`title.ilike.%${cleanQuery}%,description.ilike.%${cleanQuery}%`)
    .limit(20);

  collections?.forEach(c => items.push({ ...c, type: 'collection' }));
  cards?.forEach(c => items.push({ ...c, type: 'card' }));

  return items; // Logic to mix/sort can go here
}