import { createClient } from "@/lib/supabase/server";
import { 
  CardRepository, 
  CollectionRepository, 
  UserRepository, 
  Card, 
  Collection, 
  User 
} from "../types";
import { ok, err, Result, PaginatedResult } from "@/lib/contracts";
import { SELECT_CARD_FULL, SELECT_COLLECTION_FULL } from "@/lib/supabase/queries";

// Helper to map Supabase errors
const handleSupabaseError = (error: any, context: string): Result<any> => {
  console.error(`DB Error [${context}]:`, error);
  if (error.code === 'PGRST116') {
    return err('NOT_FOUND', 'Resource not found');
  }
  return err('INTERNAL_ERROR', error.message || 'Database error');
};

// --- Cards Adapter ---
export const cardsAdapter: CardRepository = {
  async getById(id: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cards")
      .select(SELECT_CARD_FULL)
      .eq("id", id)
      .single();

    if (error) return handleSupabaseError(error, 'cards.getById');
    return ok(data as Card);
  },

  async getTrending(limit: number) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cards")
      .select(SELECT_CARD_FULL)
      .eq("is_public", true)
      .is("collection_id", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return handleSupabaseError(error, 'cards.getTrending');
    return ok((data || []) as Card[]);
  },

  async create(payload: Partial<Card>) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cards")
      .insert(payload)
      .select()
      .single();
    
    if (error) return handleSupabaseError(error, 'cards.create');
    return ok(data as Card);
  },

  async update(id: string, payload: Partial<Card>) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cards")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
      
    if (error) return handleSupabaseError(error, 'cards.update');
    return ok(data as Card);
  },

  async delete(id: string) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("cards")
      .delete()
      .eq("id", id);
    
    if (error) return handleSupabaseError(error, 'cards.delete');
    return ok(true);
  }
};

// --- Collections Adapter ---
export const collectionsAdapter: CollectionRepository = {
  async getById(id: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("collections")
      .select(SELECT_COLLECTION_FULL)
      .eq("id", id)
      .single();

    if (error) return handleSupabaseError(error, 'collections.getById');
    
    // Fix: Cast 'owner' array to single object if needed based on query structure
    // If your SELECT_COLLECTION_FULL returns owner as an array, keep the double cast.
    return ok(data as unknown as Collection);
  },

  async getFeatured(pagination) {
    const supabase = await createClient();
    const limit = pagination?.limit || 10;
    const offset = ((pagination?.page || 1) - 1) * limit;

    const { data, error, count } = await supabase
      .from("collections")
      .select(SELECT_COLLECTION_FULL, { count: 'exact' })
      .eq("is_public", true)
      .range(offset, offset + limit - 1);

    if (error) return handleSupabaseError(error, 'collections.getFeatured');

    const items = (data || []) as unknown as Collection[];
    
    return ok({
      items,
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
      nextCursor: null
    });
  },

  async create(payload: Partial<Collection>) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("collections")
      .insert(payload)
      .select()
      .single();

    if (error) return handleSupabaseError(error, 'collections.create');
    return ok(data as unknown as Collection);
  }
};

// --- User Adapter ---
export const userAdapter: UserRepository = {
  async getCurrentUser() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return err('UNAUTHORIZED', 'No active session');
    }
    
    // Map Supabase User to App User
    const appUser = { 
      id: user.id, 
      username: user.user_metadata?.username || '',
      display_name: user.user_metadata?.display_name || '',
      avatar_url: user.user_metadata?.avatar_url,
      role: user.user_metadata?.role || 'user',
      email: user.email
    } as unknown as User;

    return ok(appUser);
  },

  async getProfile(username: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error) return handleSupabaseError(error, 'user.getProfile');
    return ok(data as User);
  }
};