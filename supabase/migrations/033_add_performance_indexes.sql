-- Migration: Add performance indexes for common queries
-- This migration adds indexes to improve query performance for:
-- - Foreign keys used in joins
-- - Fields used in WHERE clauses
-- - Fields used in ORDER BY clauses
-- - Fields used in filtering

-- Collections table indexes
CREATE INDEX IF NOT EXISTS idx_collections_owner_id ON collections(owner_id);
CREATE INDEX IF NOT EXISTS idx_collections_is_public_hidden ON collections(is_public, is_hidden) WHERE is_public = true AND is_hidden = false;
CREATE INDEX IF NOT EXISTS idx_collections_created_at_desc ON collections(created_at DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_collections_slug ON collections(slug) WHERE slug IS NOT NULL;

-- Cards table indexes
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_cards_is_public ON cards(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_cards_created_at_desc ON cards(created_at DESC) WHERE is_public = true AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_cards_created_by ON cards(created_by) WHERE created_by IS NOT NULL;
-- Note: canonical_url already has a unique index (idx_cards_canonical_url) from initial schema

-- Collection cards (junction table)
CREATE INDEX IF NOT EXISTS idx_collection_cards_collection_id ON collection_cards(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_cards_card_id ON collection_cards(card_id);
CREATE INDEX IF NOT EXISTS idx_collection_cards_added_at ON collection_cards(added_at DESC);

-- Saves table indexes
CREATE INDEX IF NOT EXISTS idx_saves_user_id ON saves(user_id);
CREATE INDEX IF NOT EXISTS idx_saves_target_type_id ON saves(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_saves_collection_id ON saves(collection_id) WHERE collection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saves_card_id ON saves(card_id) WHERE card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saves_created_at ON saves(created_at DESC);

-- Votes table indexes
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_target_type_id ON votes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at DESC);

-- Comments table indexes
CREATE INDEX IF NOT EXISTS idx_comments_target_type_id ON comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name) WHERE display_name IS NOT NULL;

-- Ranking scores indexes (already exist but ensuring they're there)
CREATE INDEX IF NOT EXISTS idx_ranking_scores_type_raw ON ranking_scores(item_type, raw_score DESC);
CREATE INDEX IF NOT EXISTS idx_ranking_scores_norm ON ranking_scores(item_type, norm_score DESC);
CREATE INDEX IF NOT EXISTS idx_ranking_scores_item ON ranking_scores(item_type, item_id);

-- Card attributions indexes
CREATE INDEX IF NOT EXISTS idx_card_attributions_card_id ON card_attributions(card_id);
CREATE INDEX IF NOT EXISTS idx_card_attributions_user_id ON card_attributions(user_id);
-- Note: card_attributions still uses stack_id for legacy support (not renamed to collection_id in migration 029)
CREATE INDEX IF NOT EXISTS idx_card_attributions_stack_id ON card_attributions(stack_id) WHERE stack_id IS NOT NULL;

-- Collection tags indexes
CREATE INDEX IF NOT EXISTS idx_collection_tags_collection_id ON collection_tags(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_tags_tag_id ON collection_tags(tag_id);

-- Tags table indexes
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Follows table indexes
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_unique ON follows(follower_id, following_id);

-- Reports table indexes
CREATE INDEX IF NOT EXISTS idx_reports_target_type_id ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Composite indexes for common query patterns

-- Collections: public collections ordered by creation date
CREATE INDEX IF NOT EXISTS idx_collections_public_created_at ON collections(is_public, created_at DESC) WHERE is_public = true AND is_hidden = false;

-- Cards: active public cards ordered by creation date
CREATE INDEX IF NOT EXISTS idx_cards_active_public_created_at ON cards(status, is_public, created_at DESC) WHERE status = 'active' AND is_public = true;

-- Saves: user saves ordered by creation date
CREATE INDEX IF NOT EXISTS idx_saves_user_created_at ON saves(user_id, created_at DESC);

-- Comments: comments for a target ordered by creation date
CREATE INDEX IF NOT EXISTS idx_comments_target_created_at ON comments(target_type, target_id, created_at DESC);

-- Analyze tables to update statistics
ANALYZE collections;
ANALYZE cards;
ANALYZE saves;
ANALYZE votes;
ANALYZE comments;
ANALYZE users;
ANALYZE ranking_scores;

