// Core user fields needed for avatars/links
export const SELECT_USER_BASIC = `
  username, 
  display_name, 
  avatar_url
`;

// Standard Collection fetch
export const SELECT_COLLECTION_FULL = `
  id, title, description, cover_image_url, owner_id, stats, created_at, slug, is_public, is_hidden,
  owner:users!collections_owner_id_fkey (${SELECT_USER_BASIC}),
  tags:collection_tags ( tag:tags ( id, name ) )
`;

// Standard Card fetch
export const SELECT_CARD_FULL = `
  id, title, description, thumbnail_url, canonical_url, domain, created_at,
  upvotes_count, saves_count, created_by, status, is_public, metadata,
  creator:users!cards_created_by_fkey (${SELECT_USER_BASIC})
`;