-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE stack_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE stack_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE clones ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user owns a stack
CREATE OR REPLACE FUNCTION owns_stack(user_id uuid, stack_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM stacks 
    WHERE id = stack_id AND owner_id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check account age (for voting restrictions)
CREATE OR REPLACE FUNCTION account_age_hours(user_id uuid)
RETURNS numeric AS $$
BEGIN
  RETURN EXTRACT(EPOCH FROM (now() - (SELECT created_at FROM users WHERE id = user_id))) / 3600;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- USERS POLICIES
-- ============================================

-- Anyone can read public user profiles
CREATE POLICY "Public profiles are viewable by everyone"
ON users FOR SELECT
TO public
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
ON users FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- ============================================
-- COLLECTIONS POLICIES (table renamed from stacks to collections in migration 029)
-- ============================================

-- Public collections are viewable by everyone
-- Private collections are viewable by owner
-- Hidden collections are viewable by owner
-- Note: Policy names and table references updated in migration 029
CREATE POLICY "Stacks are viewable based on visibility"
ON stacks FOR SELECT
TO public
USING (
  is_public = true 
  OR owner_id = auth.uid() 
  OR (is_hidden = true AND owner_id = auth.uid())
);

-- Authenticated users can create collections
-- Note: Policy name updated in migration 029
CREATE POLICY "Authenticated users can create stacks"
ON stacks FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- Owners can update their own collections
-- Note: Policy name updated in migration 029
CREATE POLICY "Owners can update own stacks"
ON stacks FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Owners and admins can delete stacks
CREATE POLICY "Owners and admins can delete stacks"
ON stacks FOR DELETE
TO authenticated
USING (owner_id = auth.uid() OR is_admin(auth.uid()));

-- ============================================
-- CARDS POLICIES
-- ============================================

-- Active cards are viewable by everyone
-- Cards in private collections are viewable by collection owner
CREATE POLICY "Cards are viewable based on status and stack visibility"
ON cards FOR SELECT
TO public
USING (
  status = 'active' AND (
    -- Card is in at least one public stack
    EXISTS (
      SELECT 1 FROM stack_cards sc
      JOIN stacks s ON sc.stack_id = s.id
      WHERE sc.card_id = cards.id AND s.is_public = true
    )
    -- OR user owns a stack containing this card
    OR EXISTS (
      SELECT 1 FROM stack_cards sc
      JOIN stacks s ON sc.stack_id = s.id
      WHERE sc.card_id = cards.id AND s.owner_id = auth.uid()
    )
  )
);

-- Authenticated users can create cards
CREATE POLICY "Authenticated users can create cards"
ON cards FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Card creators and admins can update cards
CREATE POLICY "Creators and admins can update cards"
ON cards FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR is_admin(auth.uid()))
WITH CHECK (created_by = auth.uid() OR is_admin(auth.uid()));

-- ============================================
-- COLLECTION_CARDS POLICIES (table renamed from stack_cards to collection_cards in migration 029)
-- ============================================

-- Viewable if collection is viewable
-- Note: Policy name updated in migration 029
CREATE POLICY "Stack cards are viewable with stack"
ON stack_cards FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM stacks s
    WHERE s.id = stack_cards.stack_id
    AND (s.is_public = true OR s.owner_id = auth.uid())
  )
);

-- Collection owners can add cards to their collections
CREATE POLICY "Stack owners can add cards"
ON stack_cards FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stacks s
    WHERE s.id = stack_cards.stack_id AND s.owner_id = auth.uid()
  )
);

-- Collection owners can remove cards from their collections
CREATE POLICY "Stack owners can remove cards"
ON stack_cards FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stacks s
    WHERE s.id = stack_cards.stack_id AND s.owner_id = auth.uid()
  )
);

-- ============================================
-- TAGS POLICIES
-- ============================================

-- Tags are public
CREATE POLICY "Tags are viewable by everyone"
ON tags FOR SELECT
TO public
USING (true);

-- Authenticated users can create tags
CREATE POLICY "Authenticated users can create tags"
ON tags FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================
-- STACK_TAGS POLICIES
-- ============================================

-- Viewable with stack
CREATE POLICY "Stack tags are viewable with stack"
ON stack_tags FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM stacks s
    WHERE s.id = stack_tags.stack_id
    AND (s.is_public = true OR s.owner_id = auth.uid())
  )
);

-- Collection owners can manage tags
CREATE POLICY "Stack owners can manage tags"
ON stack_tags FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stacks s
    WHERE s.id = stack_tags.stack_id AND s.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stacks s
    WHERE s.id = stack_tags.stack_id AND s.owner_id = auth.uid()
  )
);

-- ============================================
-- VOTES POLICIES
-- ============================================

-- Votes are viewable by everyone
CREATE POLICY "Votes are viewable by everyone"
ON votes FOR SELECT
TO public
USING (true);

-- Authenticated users with account age >= 48 hours can vote
CREATE POLICY "Authenticated users can vote (48h account age)"
ON votes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND account_age_hours(auth.uid()) >= 48
);

-- Users can delete their own votes
CREATE POLICY "Users can delete own votes"
ON votes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- COMMENTS POLICIES
-- ============================================

-- Comments are viewable if not deleted
CREATE POLICY "Non-deleted comments are viewable"
ON comments FOR SELECT
TO public
USING (deleted = false);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments"
ON comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
ON comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can soft-delete their own comments, collection owners can delete comments on their collections
CREATE POLICY "Users and stack owners can delete comments"
ON comments FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM stacks s
    WHERE s.id = comments.target_id 
    AND comments.target_type = 'stack'
    AND s.owner_id = auth.uid()
  )
  OR is_admin(auth.uid())
)
WITH CHECK (deleted = true);

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- System can create notifications (via service role)
-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- CLONES POLICIES
-- ============================================

-- Users can view their own clones
CREATE POLICY "Users can view own clones"
ON clones FOR SELECT
TO authenticated
USING (auth.uid() = cloner_id);

-- Authenticated users can create clones
CREATE POLICY "Authenticated users can create clones"
ON clones FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = cloner_id);

-- ============================================
-- LINK_CHECKS POLICIES
-- ============================================

-- Link checks are viewable by everyone (for transparency)
CREATE POLICY "Link checks are viewable by everyone"
ON link_checks FOR SELECT
TO public
USING (true);

-- Only service role can insert/update link checks (via workers)

-- ============================================
-- REPORTS POLICIES
-- ============================================

-- Users can view their own reports
CREATE POLICY "Users can view own reports"
ON reports FOR SELECT
TO authenticated
USING (auth.uid() = reporter_id);

-- Authenticated users can create reports
CREATE POLICY "Authenticated users can create reports"
ON reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);

-- Admins can view and update all reports
CREATE POLICY "Admins can manage all reports"
ON reports FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- ============================================
-- PAYMENTS POLICIES
-- ============================================

-- Users can view their own payments
CREATE POLICY "Users can view own payments"
ON payments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only service role can insert payments (via webhooks)

-- Admins can view all payments
CREATE POLICY "Admins can view all payments"
ON payments FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

