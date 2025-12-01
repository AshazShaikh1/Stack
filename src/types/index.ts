// Common types used across the application

export type CardType = 'link' | 'image' | 'docs';

export type StackVisibility = 'public' | 'private' | 'unlisted';

export interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  email?: string;
}

export interface Stack {
  id: string;
  title: string;
  description?: string;
  slug?: string;
  cover_image_url?: string;
  owner_id: string;
  is_public: boolean;
  is_hidden: boolean;
  created_at: string;
  owner?: User;
  stats?: {
    upvotes?: number;
    views?: number;
    cards?: number;
  };
}

export interface Card {
  id: string;
  title: string;
  description?: string;
  canonical_url: string;
  thumbnail_url?: string;
  created_at: string;
  creator_id?: string;
  creator?: User;
  metadata?: Record<string, any>;
}

export interface Notification {
  id: string;
  type: 'follow' | 'upvote' | 'comment' | 'clone';
  actor_id: string;
  data: {
    stack_id?: string;
    stack_title?: string;
    card_id?: string;
    comment_id?: string;
    comment_content?: string;
  };
  read: boolean;
  created_at: string;
  actor: User;
}

export interface Comment {
  id: string;
  content: string;
  user_id: string;
  target_type: 'stack' | 'card';
  target_id: string;
  parent_id?: string;
  deleted: boolean;
  created_at: string;
  updated_at?: string;
  user?: User;
  edited?: boolean;
}

export interface FileData {
  name: string;
  type: string;
  size: number;
  data: string; // data URL
  cardType: 'image' | 'docs';
  title?: string;
  description?: string;
  imageUrl?: string;
}

