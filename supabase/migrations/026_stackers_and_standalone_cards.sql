-- Migration: Stackers and Standalone Cards
-- This migration adds support for:
-- 1. Card attributions tracking
-- 2. Standalone cards (is_public field)
-- 3. Card counters for ranking
-- 4. Explore ranking items for mixed feed

-- ============================================
-- 1. Ensure users.role is correct (already exists, but verify)
-- ============================================
-- users.role already exists with CHECK (role IN ('user', 'stacker', 'admin'))
-- Default is 'user' which is correct

-- Helper function to check if user is stacker
CREATE OR REPLACE FUNCTION is_stacker(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = user_id AND role = 'stacker'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user can publish
CREATE OR REPLACE FUNCTION can_publish(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = user_id AND (role = 'stacker' OR role = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. Add card_attributions table
-- ============================================
CREATE TABLE IF NOT EXISTS card_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  source text NOT NULL CHECK (source IN ('extension', 'manual', 'stack', 'import')),
  stack_id uuid NULL REFERENCES stacks(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(card_id, user_id, source, stack_id)
);

CREATE INDEX IF NOT EXISTS idx_card_attributions_card ON card_attributions(card_id);
CREATE INDEX IF NOT EXISTS idx_card_attributions_user ON card_attributions(user_id);
CREATE INDEX IF NOT EXISTS idx_card_attributions_stack ON card_attributions(stack_id) WHERE stack_id IS NOT NULL;

-- ============================================
-- 3. Add is_public and counters to cards table
-- ============================================
-- Add is_public column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cards' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE cards ADD COLUMN is_public boolean DEFAULT true;
    CREATE INDEX IF NOT EXISTS idx_cards_is_public ON cards(is_public) WHERE is_public = true;
  END IF;
END $$;

-- Add counter columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cards' AND column_name = 'visits_count'
  ) THEN
    ALTER TABLE cards ADD COLUMN visits_count integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cards' AND column_name = 'saves_count'
  ) THEN
    ALTER TABLE cards ADD COLUMN saves_count integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cards' AND column_name = 'upvotes_count'
  ) THEN
    ALTER TABLE cards ADD COLUMN upvotes_count integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cards' AND column_name = 'comments_count'
  ) THEN
    ALTER TABLE cards ADD COLUMN comments_count integer DEFAULT 0;
  END IF;
END $$;

-- Add indexes for counters (for ranking queries)
CREATE INDEX IF NOT EXISTS idx_cards_upvotes_count ON cards(upvotes_count DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_cards_saves_count ON cards(saves_count DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at DESC) WHERE is_public = true;

-- ============================================
-- 4. Create explore_ranking_items table
-- ============================================
CREATE TABLE IF NOT EXISTS explore_ranking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('card', 'stack')),
  item_id uuid NOT NULL,
  raw_score numeric NOT NULL DEFAULT 0,
  norm_score numeric NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_ranking_items_type_id ON explore_ranking_items(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_ranking_items_norm_score ON explore_ranking_items(norm_score DESC);
CREATE INDEX IF NOT EXISTS idx_ranking_items_updated ON explore_ranking_items(updated_at DESC);

-- ============================================
-- 5. Function to update card counters from related tables
-- ============================================
CREATE OR REPLACE FUNCTION update_card_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'votes' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE cards SET upvotes_count = upvotes_count + 1
      WHERE id = NEW.target_id AND NEW.target_type = 'card';
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE cards SET upvotes_count = GREATEST(upvotes_count - 1, 0)
      WHERE id = OLD.target_id AND OLD.target_type = 'card';
    END IF;
  ELSIF TG_TABLE_NAME = 'saves' THEN
    -- Saves are for stacks, not cards, but we track card saves via card_attributions
    -- This will be handled separately
    NULL;
  ELSIF TG_TABLE_NAME = 'comments' THEN
    IF TG_OP = 'INSERT' AND NEW.deleted = false THEN
      UPDATE cards SET comments_count = comments_count + 1
      WHERE id = NEW.target_id AND NEW.target_type = 'card';
    ELSIF TG_OP = 'UPDATE' AND OLD.deleted = false AND NEW.deleted = true THEN
      UPDATE cards SET comments_count = GREATEST(comments_count - 1, 0)
      WHERE id = NEW.target_id AND NEW.target_type = 'card';
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for counter updates
DROP TRIGGER IF EXISTS update_card_counters_votes ON votes;
CREATE TRIGGER update_card_counters_votes
  AFTER INSERT OR DELETE ON votes
  FOR EACH ROW
  EXECUTE FUNCTION update_card_counters();

DROP TRIGGER IF EXISTS update_card_counters_comments ON comments;
CREATE TRIGGER update_card_counters_comments
  AFTER INSERT OR UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_card_counters();

-- ============================================
-- 6. RLS Policies for card_attributions
-- ============================================
ALTER TABLE card_attributions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can view card attributions" ON card_attributions;
DROP POLICY IF EXISTS "Users can create their own attributions" ON card_attributions;
DROP POLICY IF EXISTS "Users can delete their own attributions" ON card_attributions;

-- Users can view attributions for public cards or cards they own
CREATE POLICY "Users can view card attributions"
  ON card_attributions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cards
      WHERE cards.id = card_attributions.card_id
      AND (cards.is_public = true OR cards.created_by = auth.uid())
    )
  );

-- Users can create their own attributions
CREATE POLICY "Users can create their own attributions"
  ON card_attributions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own attributions
CREATE POLICY "Users can delete their own attributions"
  ON card_attributions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 7. RLS Policy updates for cards visibility
-- ============================================
-- Update cards SELECT policy to include is_public
-- First, drop any existing policies that might conflict
DO $$ 
BEGIN
  -- Drop existing policies that might conflict
  DROP POLICY IF EXISTS "Public cards are viewable" ON cards;
  -- Drop other potential card policies if they exist
  DROP POLICY IF EXISTS "Cards are viewable" ON cards;
  DROP POLICY IF EXISTS "Users can view cards" ON cards;
END $$;

CREATE POLICY "Public cards are viewable"
  ON cards FOR SELECT
  USING (
    is_public = true 
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM stack_cards sc
      JOIN stacks s ON s.id = sc.stack_id
      WHERE sc.card_id = cards.id
      AND (s.is_public = true OR s.owner_id = auth.uid())
    )
  );

-- ============================================
-- 8. RLS Policy for stack publishing (stacker only)
-- ============================================
-- Note: We don't drop "Owners can update their stacks" as it may be needed
-- Instead, we add a more specific policy that takes precedence
-- The specific policy will be checked first due to PostgreSQL policy ordering

-- Drop the new policy if it exists
DROP POLICY IF EXISTS "Only stackers can publish stacks" ON stacks;

-- Add specific policy for publishing (is_public = true)
-- This policy is more restrictive and will be checked
CREATE POLICY "Only stackers can publish stacks"
  ON stacks FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND (
      is_public = false 
      OR can_publish(auth.uid())
    )
  );
  
-- Note: The existing "Owners can update their stacks" policy will still work
-- for non-publishing updates. The "Only stackers can publish stacks" policy
-- is more specific and will be checked for updates that set is_public = true.

