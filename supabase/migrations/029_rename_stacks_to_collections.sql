-- ============================================
-- RENAME STACKS TO COLLECTIONS
-- ============================================
-- This migration renames all stack-related tables and columns to collection

-- Rename main table
ALTER TABLE stacks RENAME TO collections;

-- Rename foreign key constraints
ALTER TABLE collections RENAME CONSTRAINT stacks_owner_id_fkey TO collections_owner_id_fkey;

-- Rename indexes
ALTER INDEX idx_stacks_owner RENAME TO idx_collections_owner;
ALTER INDEX idx_stacks_is_public RENAME TO idx_collections_is_public;
ALTER INDEX idx_stacks_slug RENAME TO idx_collections_slug;
ALTER INDEX idx_stacks_promoted RENAME TO idx_collections_promoted;

-- Rename stack_cards table
ALTER TABLE stack_cards RENAME TO collection_cards;
ALTER TABLE collection_cards RENAME COLUMN stack_id TO collection_id;
ALTER INDEX idx_stack_cards_stack RENAME TO idx_collection_cards_collection;
ALTER INDEX idx_stack_cards_card RENAME TO idx_collection_cards_card;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stack_cards_stack_id_fkey') THEN
    ALTER TABLE collection_cards RENAME CONSTRAINT stack_cards_stack_id_fkey TO collection_cards_collection_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stack_cards_card_id_fkey') THEN
    ALTER TABLE collection_cards RENAME CONSTRAINT stack_cards_card_id_fkey TO collection_cards_card_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stack_cards_added_by_fkey') THEN
    ALTER TABLE collection_cards RENAME CONSTRAINT stack_cards_added_by_fkey TO collection_cards_added_by_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stack_cards_stack_id_card_id_key') THEN
    ALTER TABLE collection_cards RENAME CONSTRAINT stack_cards_stack_id_card_id_key TO collection_cards_collection_id_card_id_key;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stack_cards_pkey') THEN
    ALTER TABLE collection_cards RENAME CONSTRAINT stack_cards_pkey TO collection_cards_pkey;
  END IF;
END $$;

-- Rename stack_tags table
ALTER TABLE stack_tags RENAME TO collection_tags;
ALTER TABLE collection_tags RENAME COLUMN stack_id TO collection_id;
ALTER INDEX idx_stack_tags_stack RENAME TO idx_collection_tags_collection;
ALTER INDEX idx_stack_tags_tag RENAME TO idx_collection_tags_tag;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stack_tags_stack_id_fkey') THEN
    ALTER TABLE collection_tags RENAME CONSTRAINT stack_tags_stack_id_fkey TO collection_tags_collection_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stack_tags_tag_id_fkey') THEN
    ALTER TABLE collection_tags RENAME CONSTRAINT stack_tags_tag_id_fkey TO collection_tags_tag_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stack_tags_stack_id_tag_id_key') THEN
    ALTER TABLE collection_tags RENAME CONSTRAINT stack_tags_stack_id_tag_id_key TO collection_tags_collection_id_tag_id_key;
  END IF;
  -- Also check for primary key constraint (if it exists as a named constraint)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stack_tags_pkey') THEN
    ALTER TABLE collection_tags RENAME CONSTRAINT stack_tags_pkey TO collection_tags_pkey;
  END IF;
END $$;

-- Update comments table target_type
-- First drop ALL possible constraints on target_type, then update data, then recreate constraint
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Drop any check constraint on comments.target_type
  FOR constraint_name IN 
    SELECT conname FROM pg_constraint 
    WHERE conrelid = 'comments'::regclass 
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%target_type%'
  LOOP
    EXECUTE format('ALTER TABLE comments DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;
UPDATE comments SET target_type = 'collection' WHERE target_type = 'stack';

-- Update notifications data JSONB (stack_id → collection_id)
UPDATE notifications 
SET data = jsonb_set(
  data - 'stack_id' - 'stack_title',
  '{collection_id}',
  data->'stack_id'
) || jsonb_build_object('collection_title', data->'stack_title')
WHERE data ? 'stack_id';

-- Update votes table (if it references stacks)
-- Note: Check if votes table has stack references and update accordingly

-- Update clones table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clones') THEN
    ALTER TABLE clones RENAME COLUMN original_stack_id TO original_collection_id;
    ALTER TABLE clones RENAME COLUMN new_stack_id TO new_collection_id;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_clones_original') THEN
      ALTER INDEX idx_clones_original RENAME TO idx_clones_original_collection;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clones_original_stack_id_fkey') THEN
      ALTER TABLE clones RENAME CONSTRAINT clones_original_stack_id_fkey TO clones_original_collection_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clones_new_stack_id_fkey') THEN
      ALTER TABLE clones RENAME CONSTRAINT clones_new_stack_id_fkey TO clones_new_collection_id_fkey;
    END IF;
  END IF;
END $$;

-- Update saves table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saves') THEN
    ALTER TABLE saves RENAME COLUMN stack_id TO collection_id;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_saves_stack') THEN
      ALTER INDEX idx_saves_stack RENAME TO idx_saves_collection;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saves_stack_id_fkey') THEN
      ALTER TABLE saves RENAME CONSTRAINT saves_stack_id_fkey TO saves_collection_id_fkey;
    END IF;
  END IF;
END $$;

-- Update saves trigger function to reference collections (if saves table exists)
-- First create/replace the function (always do this, function can be used even if saves table doesn't exist yet)
CREATE OR REPLACE FUNCTION update_collection_saves_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE collections
    SET stats = jsonb_set(
      COALESCE(stats, '{}'::jsonb),
      '{saves}',
      to_jsonb((COALESCE((stats->>'saves')::int, 0) + 1))
    )
    WHERE id = NEW.collection_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE collections
    SET stats = jsonb_set(
      COALESCE(stats, '{}'::jsonb),
      '{saves}',
      to_jsonb(GREATEST((COALESCE((stats->>'saves')::int, 0) - 1), 0))
    )
    WHERE id = OLD.collection_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Rename saves trigger if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saves') THEN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_stack_saves_count_trigger') THEN
      ALTER TRIGGER update_stack_saves_count_trigger ON saves RENAME TO update_collection_saves_count_trigger;
    END IF;
  END IF;
END $$;

-- Update reports table target_type
UPDATE reports SET target_type = 'collection' WHERE target_type = 'stack';

-- Update triggers and functions
ALTER FUNCTION update_stacks_search_vector() RENAME TO update_collections_search_vector;
ALTER TRIGGER stacks_search_vector_update ON collections RENAME TO collections_search_vector_update;

-- Update votes table target_type
-- First drop ALL possible constraints on target_type, then update data, then recreate constraint
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Drop any check constraint on votes.target_type
  FOR constraint_name IN 
    SELECT conname FROM pg_constraint 
    WHERE conrelid = 'votes'::regclass 
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%target_type%'
  LOOP
    EXECUTE format('ALTER TABLE votes DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;
UPDATE votes SET target_type = 'collection' WHERE target_type = 'stack';
ALTER TABLE votes ADD CONSTRAINT votes_target_type_check CHECK (target_type IN ('collection', 'card'));

-- Recreate comments constraint (data already updated above)
ALTER TABLE comments ADD CONSTRAINT comments_target_type_check CHECK (target_type IN ('collection', 'card'));

-- Update RLS policies - drop old ones
DROP POLICY IF EXISTS "Stacks are viewable based on visibility" ON collections;
DROP POLICY IF EXISTS "Authenticated users can create stacks" ON collections;
DROP POLICY IF EXISTS "Owners can update own stacks" ON collections;
DROP POLICY IF EXISTS "Owners and admins can delete stacks" ON collections;

-- Recreate policies with new names
CREATE POLICY "Collections are viewable based on visibility"
ON collections FOR SELECT
TO public
USING (
  is_public = true 
  OR owner_id = auth.uid() 
  OR (is_hidden = true AND owner_id = auth.uid())
);

CREATE POLICY "Authenticated users can create collections"
ON collections FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update own collections"
ON collections FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners and admins can delete collections"
ON collections FOR DELETE
TO authenticated
USING (owner_id = auth.uid() OR is_admin(auth.uid()));

-- Update collection_cards policies (formerly stack_cards)
DROP POLICY IF EXISTS "Stack cards are viewable based on stack visibility" ON collection_cards;
DROP POLICY IF EXISTS "Authenticated users can add cards to stacks" ON collection_cards;
DROP POLICY IF EXISTS "Users can remove cards from their stacks" ON collection_cards;

CREATE POLICY "Collection cards are viewable based on collection visibility"
ON collection_cards FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_cards.collection_id
    AND (c.is_public = true OR c.owner_id = auth.uid())
  )
);

CREATE POLICY "Authenticated users can add cards to collections"
ON collection_cards FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_cards.collection_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can remove cards from their collections"
ON collection_cards FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_cards.collection_id
    AND c.owner_id = auth.uid()
  )
);

-- Update explore_ranking materialized view if it exists
-- Note: This may need to be refreshed after the migration
DROP MATERIALIZED VIEW IF EXISTS explore_ranking CASCADE;

-- Recreate explore_ranking with collections
CREATE MATERIALIZED VIEW IF NOT EXISTS explore_ranking AS
SELECT 
  c.id AS collection_id,
  (
    -- Upvotes weighted
    (COALESCE((c.stats->>'upvotes')::int, 0) * 0.8) +
    -- Saves weighted
    (COALESCE((c.stats->>'saves')::int, 0) * 3.0) +
    -- Comments weighted
    (COALESCE((c.stats->>'comments')::int, 0) * 2.0)
  ) AS score,
  c.created_at
FROM collections c
WHERE c.is_public = true AND c.is_hidden = false;

CREATE INDEX IF NOT EXISTS idx_explore_ranking_score ON explore_ranking (score DESC);
CREATE INDEX IF NOT EXISTS idx_explore_ranking_collection ON explore_ranking (collection_id);

