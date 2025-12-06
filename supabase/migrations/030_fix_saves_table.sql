-- ============================================
-- FIX SAVES TABLE - Ensure it exists with correct structure
-- ============================================
-- This migration ensures the saves table exists with collection_id
-- and handles both new installations and migrations from stack_id (legacy support)

-- Create saves table if it doesn't exist (with collection_id and card_id support)
-- Note: We'll add the unique constraint separately after ensuring columns exist
CREATE TABLE IF NOT EXISTS saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  target_type text NOT NULL DEFAULT 'collection' CHECK (target_type IN ('collection', 'card')),
  target_id uuid NOT NULL,
  collection_id uuid REFERENCES collections(id) ON DELETE CASCADE,
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
  stack_id uuid, -- Legacy column, will be removed after migration
  created_at timestamptz DEFAULT now()
);

-- Add new columns if they don't exist (for existing tables)
DO $$
BEGIN
  -- Add target_type and target_id for polymorphic saves
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saves' AND column_name = 'target_type'
  ) THEN
    ALTER TABLE saves ADD COLUMN target_type text CHECK (target_type IN ('collection', 'card'));
    -- Set default for existing rows
    UPDATE saves SET target_type = 'collection' WHERE target_type IS NULL;
    ALTER TABLE saves ALTER COLUMN target_type SET NOT NULL;
    ALTER TABLE saves ALTER COLUMN target_type SET DEFAULT 'collection';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saves' AND column_name = 'target_id'
  ) THEN
    ALTER TABLE saves ADD COLUMN target_id uuid;
    -- Migrate existing collection_id/stack_id to target_id
    UPDATE saves SET target_id = COALESCE(collection_id, stack_id) WHERE target_id IS NULL;
    ALTER TABLE saves ALTER COLUMN target_id SET NOT NULL;
  END IF;
  
  -- Add collection_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saves' AND column_name = 'collection_id'
  ) THEN
    ALTER TABLE saves ADD COLUMN collection_id uuid REFERENCES collections(id) ON DELETE CASCADE;
  END IF;
  
  -- Add card_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saves' AND column_name = 'card_id'
  ) THEN
    ALTER TABLE saves ADD COLUMN card_id uuid REFERENCES cards(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Migrate data from stack_id to collection_id and target_id if needed
DO $$
BEGIN
  -- Migrate existing saves to use target_type and target_id
  UPDATE saves 
  SET 
    target_type = 'collection',
    target_id = COALESCE(collection_id, stack_id),
    collection_id = COALESCE(collection_id, stack_id)
  WHERE target_id IS NULL OR (collection_id IS NULL AND stack_id IS NOT NULL);
  
  -- Ensure target_id matches collection_id or card_id
  UPDATE saves
  SET target_id = collection_id
  WHERE target_type = 'collection' AND target_id IS NULL AND collection_id IS NOT NULL;
  
  UPDATE saves
  SET target_id = card_id
  WHERE target_type = 'card' AND target_id IS NULL AND card_id IS NOT NULL;
END $$;

-- Add unique constraint to prevent duplicate saves
-- Drop existing constraint if it exists
DO $$
BEGIN
  -- Drop old unique constraints if they exist
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'saves_user_id_stack_id_key'
  ) THEN
    ALTER TABLE saves DROP CONSTRAINT saves_user_id_stack_id_key;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'saves_user_id_collection_id_key'
  ) THEN
    ALTER TABLE saves DROP CONSTRAINT saves_user_id_collection_id_key;
  END IF;
END $$;

-- Create unique constraint on (user_id, target_type, target_id) for polymorphic saves
DO $$
BEGIN
  -- Drop old unique constraints if they exist
  DROP INDEX IF EXISTS saves_user_collection_unique;
  DROP INDEX IF EXISTS saves_user_stack_unique;
  
  -- Create unique index for polymorphic saves
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'saves_user_target_unique'
  ) THEN
    CREATE UNIQUE INDEX saves_user_target_unique 
    ON saves (user_id, target_type, target_id);
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_saves_user ON saves (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saves_target ON saves (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_saves_collection ON saves (collection_id) WHERE collection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saves_card ON saves (card_id) WHERE card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saves_stack ON saves (stack_id) WHERE stack_id IS NOT NULL;

-- Enable RLS if not already enabled
ALTER TABLE saves ENABLE ROW LEVEL SECURITY;

-- Drop and recreate RLS policies to ensure they're correct
DROP POLICY IF EXISTS "Users can view their own saves" ON saves;
CREATE POLICY "Users can view their own saves"
  ON saves FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own saves" ON saves;
CREATE POLICY "Users can create their own saves"
  ON saves FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own saves" ON saves;
CREATE POLICY "Users can delete their own saves"
  ON saves FOR DELETE
  USING (auth.uid() = user_id);

-- Ensure the trigger function exists and is correct (supports both collections and cards)
CREATE OR REPLACE FUNCTION update_collection_saves_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update collection stats if target is a collection
    IF NEW.target_type = 'collection' THEN
      UPDATE collections
      SET stats = jsonb_set(
        COALESCE(stats, '{}'::jsonb),
        '{saves}',
        to_jsonb((COALESCE((stats->>'saves')::int, 0) + 1))
      )
      WHERE id = COALESCE(NEW.collection_id, NEW.target_id, NEW.stack_id);
    -- Update card stats if target is a card
    ELSIF NEW.target_type = 'card' THEN
      UPDATE cards
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{saves}',
        to_jsonb((COALESCE((metadata->>'saves')::int, 0) + 1))
      )
      WHERE id = COALESCE(NEW.card_id, NEW.target_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Update collection stats if target is a collection
    IF OLD.target_type = 'collection' THEN
      UPDATE collections
      SET stats = jsonb_set(
        COALESCE(stats, '{}'::jsonb),
        '{saves}',
        to_jsonb(GREATEST((COALESCE((stats->>'saves')::int, 0) - 1), 0))
      )
      WHERE id = COALESCE(OLD.collection_id, OLD.target_id, OLD.stack_id);
    -- Update card stats if target is a card
    ELSIF OLD.target_type = 'card' THEN
      UPDATE cards
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{saves}',
        to_jsonb(GREATEST((COALESCE((metadata->>'saves')::int, 0) - 1), 0))
      )
      WHERE id = COALESCE(OLD.card_id, OLD.target_id);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if it exists
DROP TRIGGER IF EXISTS update_stack_saves_count_trigger ON saves;
DROP TRIGGER IF EXISTS update_collection_saves_count_trigger ON saves;

-- Create the trigger
CREATE TRIGGER update_collection_saves_count_trigger
  AFTER INSERT OR DELETE ON saves
  FOR EACH ROW
  EXECUTE FUNCTION update_collection_saves_count();

