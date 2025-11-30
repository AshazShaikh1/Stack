-- ============================================
-- FOLLOWS TABLE
-- ============================================
CREATE TABLE follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  following_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id) -- Prevent self-follows
);

-- Indexes for follows
CREATE INDEX idx_follows_follower ON follows (follower_id, created_at DESC);
CREATE INDEX idx_follows_following ON follows (following_id, created_at DESC);

-- Function to get follower count
CREATE OR REPLACE FUNCTION get_follower_count(user_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (SELECT COUNT(*)::integer FROM follows WHERE following_id = user_id);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get following count
CREATE OR REPLACE FUNCTION get_following_count(user_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (SELECT COUNT(*)::integer FROM follows WHERE follower_id = user_id);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if user A follows user B
CREATE OR REPLACE FUNCTION is_following(follower_id uuid, following_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM follows WHERE follows.follower_id = is_following.follower_id AND follows.following_id = is_following.following_id);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- RLS POLICIES FOR FOLLOWS
-- ============================================
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Anyone can view follows (for follower/following counts)
CREATE POLICY "Anyone can view follows"
ON follows FOR SELECT
TO authenticated
USING (true);

-- Users can create their own follows
CREATE POLICY "Users can create their own follows"
ON follows FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = follower_id);

-- Users can delete their own follows (unfollow)
CREATE POLICY "Users can delete their own follows"
ON follows FOR DELETE
TO authenticated
USING (auth.uid() = follower_id);

