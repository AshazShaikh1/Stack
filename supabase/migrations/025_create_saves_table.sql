-- Create saves table for users to save stacks
CREATE TABLE IF NOT EXISTS saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  stack_id uuid REFERENCES stacks(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, stack_id)
);

-- Indexes for saves
CREATE INDEX IF NOT EXISTS idx_saves_user ON saves (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saves_stack ON saves (stack_id);

-- RLS Policies for saves
ALTER TABLE saves ENABLE ROW LEVEL SECURITY;

-- Users can view their own saves
CREATE POLICY "Users can view their own saves"
  ON saves FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own saves
CREATE POLICY "Users can create their own saves"
  ON saves FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own saves
CREATE POLICY "Users can delete their own saves"
  ON saves FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update stack saves count
CREATE OR REPLACE FUNCTION update_stack_saves_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE stacks
    SET stats = jsonb_set(
      COALESCE(stats, '{}'::jsonb),
      '{saves}',
      to_jsonb((COALESCE((stats->>'saves')::int, 0) + 1))
    )
    WHERE id = NEW.stack_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE stacks
    SET stats = jsonb_set(
      COALESCE(stats, '{}'::jsonb),
      '{saves}',
      to_jsonb(GREATEST((COALESCE((stats->>'saves')::int, 0) - 1), 0))
    )
    WHERE id = OLD.stack_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update saves count
CREATE TRIGGER update_stack_saves_count_trigger
  AFTER INSERT OR DELETE ON saves
  FOR EACH ROW
  EXECUTE FUNCTION update_stack_saves_count();

