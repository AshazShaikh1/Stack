export interface User {
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  role?: string;
}

export interface Card {
  id: string;
  title: string;
  description?: string;
  url?: string;
  thumbnail_url?: string;
  canonical_url?: string;
  domain?: string;
  created_at: string;
  updated_at?: string;
  owner_id?: string;
  collection_id?: string | null;
  is_public?: boolean;
  status?: 'active' | 'archived' | 'deleted';
  stats?: {
    views?: number;
    upvotes?: number;
    saves?: number;
  };
  // Add other fields as your app needs them
  [key: string]: any; 
}

export interface Collection {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  cover_image_url?: string;
  owner_id: string;
  is_public: boolean;
  created_at: string;
  updated_at?: string;
  cards?: Card[];
  owner?: User;
  stats?: {
    views?: number;
    upvotes?: number;
    saves?: number;
  };
  [key: string]: any;
}

// --- Repository Interfaces ( The "Contract" ) ---

export interface CardRepository {
  getById(id: string): Promise<Card | null>;
  getTrending(limit: number): Promise<Card[]>;
  create(data: Partial<Card>): Promise<Card>;
  update(id: string, data: Partial<Card>): Promise<Card>;
  delete(id: string): Promise<boolean>;
}

export interface CollectionRepository {
  getById(id: string): Promise<Collection | null>;
  getFeatured(): Promise<Collection[]>;
  create(data: Partial<Collection>): Promise<Collection>;
  update(id: string, data: Partial<Collection>): Promise<Collection>;
}

export interface UserRepository {
  getCurrentUser(): Promise<User | null>;
  getProfile(username: string): Promise<User | null>;
}