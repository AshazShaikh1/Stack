import { createClient } from "@/lib/supabase/server";
import { CardRepository, CollectionRepository, UserRepository, Card, Collection, User } from "../types";
import { SELECT_CARD_FULL, SELECT_COLLECTION_FULL } from "@/lib/supabase/queries";

// --- Cards Adapter ---
export const cardsAdapter: CardRepository = {
  async getById(id: string) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cards")
      .select(SELECT_CARD_FULL)
      .eq("id", id)
      .single();
    return data as Card | null;
  },

  async getTrending(limit: number) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cards")
      .select(SELECT_CARD_FULL)
      .eq("is_public", true)
      .is("collection_id", null) // Standalone cards
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data || []) as Card[];
  },

  async create(payload: Partial<Card>) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cards")
      .insert(payload)
      .select()
      .single();
    
    if (error) throw error;
    return data as Card;
  },

  async update(id: string, payload: Partial<Card>) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cards")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
      
    if (error) throw error;
    return data as Card;
  },

  async delete(id: string) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("cards")
      .delete()
      .eq("id", id);
    return !error;
  }
};

// --- Collections Adapter ---
export const collectionsAdapter: CollectionRepository = {
  async getById(id: string) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("collections")
      .select(SELECT_COLLECTION_FULL)
      .eq("id", id)
      .single();
    return data as Collection | null;
  },

  async getFeatured() {
    const supabase = await createClient();
    const { data } = await supabase
      .from("collections")
      .select(SELECT_COLLECTION_FULL)
      .eq("is_public", true)
      .limit(10);
    return (data || []) as unknown as Collection[];
  },

  async create(payload: Partial<Collection>) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("collections")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as Collection;
  },

  async update(id: string, payload: Partial<Collection>) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("collections")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Collection;
  }
};

// --- User Adapter ---
export const userAdapter: UserRepository = {
  async getCurrentUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    // We map Supabase User to our internal User type
    return { 
      id: user.id, 
      role: user.user_metadata?.role || 'user',
      // Map other fields as necessary from user_metadata
    } as User;
  },

  async getProfile(username: string) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();
    return data as User | null;
  }
};