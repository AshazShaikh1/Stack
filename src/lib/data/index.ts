import { cardsAdapter, collectionsAdapter, userAdapter } from "./adapters/supabase";

/**
 * The Data Access Layer (DAL).
 * Usage:
 * import { db } from "@/lib/data";
 * const card = await db.cards.getById(id);
 */
export const db = {
  cards: cardsAdapter,
  collections: collectionsAdapter,
  users: userAdapter,
};