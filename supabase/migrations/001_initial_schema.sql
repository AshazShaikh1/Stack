-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  email_verified boolean DEFAULT false,
  username citext UNIQUE NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  role text DEFAULT 'user' CHECK (role IN ('user', 'stacker', 'admin')),
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz,
  quality_score numeric DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
  metadata jsonb DEFAULT '{}'
);

-- Indexes for users
CREATE UNIQUE INDEX idx_users_username_lower ON users (LOWER(username::text));
CREATE UNIQUE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_quality_score ON users (quality_score DESC);

-- ============================================
-- 2. COLLECTIONS TABLE (formerly stacks)
-- ============================================
CREATE TABLE stacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  slug text UNIQUE NOT NULL,
  is_public boolean DEFAULT false,
  is_hidden boolean DEFAULT false,
  cover_image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  stats jsonb DEFAULT '{"views":0,"upvotes":0,"saves":0,"comments":0}',
  promoted_until timestamptz,
  search_vector tsvector
);

-- Indexes for collections (stacks table renamed in migration 029)
CREATE INDEX idx_stacks_owner ON stacks (owner_id);
CREATE INDEX idx_stacks_is_public ON stacks (is_public) WHERE is_public = true;
CREATE INDEX idx_stacks_slug ON stacks (slug);
CREATE INDEX idx_stacks_promoted ON stacks (promoted_until DESC) WHERE promoted_until IS NOT NULL;
CREATE INDEX idx_stacks_search_vector ON stacks USING GIN (search_vector);
CREATE INDEX idx_stacks_title_trgm ON stacks USING GIN (title gin_trgm_ops);
CREATE INDEX idx_stacks_created_at ON stacks (created_at DESC);

-- Trigger to update search_vector
CREATE OR REPLACE FUNCTION update_stacks_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, ''));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stacks_search_vector_update
  BEFORE INSERT OR UPDATE ON stacks
  FOR EACH ROW
  EXECUTE FUNCTION update_stacks_search_vector();

-- ============================================
-- 3. CARDS TABLE (canonical resources)
-- ============================================
CREATE TABLE cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_url text UNIQUE NOT NULL,
  title text,
  description text,
  thumbnail_url text,
  domain text,
  metadata jsonb DEFAULT '{}',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  last_checked_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'removed', 'broken', 'archived')),
  search_vector tsvector
);

-- Indexes for cards
CREATE UNIQUE INDEX idx_cards_canonical_url ON cards (canonical_url);
CREATE INDEX idx_cards_domain ON cards (domain);
CREATE INDEX idx_cards_status ON cards (status) WHERE status = 'active';
CREATE INDEX idx_cards_created_by ON cards (created_by);
CREATE INDEX idx_cards_search_vector ON cards USING GIN (search_vector);
CREATE INDEX idx_cards_title_trgm ON cards USING GIN (title gin_trgm_ops);

-- Trigger to update search_vector
CREATE OR REPLACE FUNCTION update_cards_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cards_search_vector_update
  BEFORE INSERT OR UPDATE ON cards
  FOR EACH ROW
  EXECUTE FUNCTION update_cards_search_vector();

-- ============================================
-- 4. STACK_CARDS TABLE (many-to-many)
-- ============================================
CREATE TABLE stack_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stack_id uuid REFERENCES stacks(id) ON DELETE CASCADE NOT NULL,
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE NOT NULL,
  added_by uuid REFERENCES users(id) ON DELETE SET NULL,
  added_at timestamptz DEFAULT now(),
  position integer,
  note text,
  UNIQUE(stack_id, card_id)
);

-- Indexes for stack_cards
CREATE INDEX idx_stack_cards_stack ON stack_cards (stack_id);
CREATE INDEX idx_stack_cards_card ON stack_cards (card_id);
CREATE INDEX idx_stack_cards_position ON stack_cards (stack_id, position);

-- ============================================
-- 5. TAGS TABLE
-- ============================================
CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name citext UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tags_name ON tags (name);

-- ============================================
-- 6. STACK_TAGS TABLE
-- ============================================
CREATE TABLE stack_tags (
  stack_id uuid REFERENCES stacks(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (stack_id, tag_id)
);

CREATE INDEX idx_stack_tags_tag ON stack_tags (tag_id);
CREATE INDEX idx_stack_tags_stack ON stack_tags (stack_id);

-- ============================================
-- 7. CARD_TAGS TABLE
-- ============================================
CREATE TABLE card_tags (
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, tag_id)
);

CREATE INDEX idx_card_tags_tag ON card_tags (tag_id);
CREATE INDEX idx_card_tags_card ON card_tags (card_id);

-- ============================================
-- 8. VOTES TABLE
-- ============================================
CREATE TABLE votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('stack', 'card')),
  target_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

-- Indexes for votes
CREATE INDEX idx_votes_target ON votes (target_type, target_id);
CREATE INDEX idx_votes_user ON votes (user_id);
CREATE INDEX idx_votes_created_at ON votes (created_at DESC);

-- ============================================
-- 9. COMMENTS TABLE
-- ============================================
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('stack', 'card')),
  target_id uuid NOT NULL,
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- Indexes for comments
CREATE INDEX idx_comments_target ON comments (target_type, target_id, created_at);
CREATE INDEX idx_comments_parent ON comments (parent_id);
CREATE INDEX idx_comments_user ON comments (user_id);
CREATE INDEX idx_comments_deleted ON comments (deleted) WHERE deleted = false;

-- ============================================
-- 10. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('upvote', 'comment', 'clone', 'follow')),
  data jsonb DEFAULT '{}',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_read ON notifications (user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_type ON notifications (type);

-- ============================================
-- 11. CLONES TABLE
-- ============================================
CREATE TABLE clones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_stack_id uuid REFERENCES stacks(id) ON DELETE CASCADE NOT NULL,
  new_stack_id uuid REFERENCES stacks(id) ON DELETE CASCADE NOT NULL,
  cloner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_clones_cloner ON clones (cloner_id, created_at DESC);
CREATE INDEX idx_clones_original ON clones (original_stack_id);

-- ============================================
-- 12. LINK_CHECKS TABLE
-- ============================================
CREATE TABLE link_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
  last_checked_at timestamptz DEFAULT now(),
  status text CHECK (status IN ('ok', 'redirect', 'broken', 'timeout')),
  status_code integer,
  redirect_url text,
  response_time_ms integer,
  attempts integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_link_checks_card ON link_checks (card_id);
CREATE INDEX idx_link_checks_status ON link_checks (status, last_checked_at);
CREATE INDEX idx_link_checks_broken ON link_checks (status) WHERE status = 'broken';

-- ============================================
-- 14. REPORTS TABLE
-- ============================================
CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text,
  data jsonb DEFAULT '{}',
  status text DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_reports_status ON reports (status, created_at DESC);
CREATE INDEX idx_reports_target ON reports (target_type, target_id);
CREATE INDEX idx_reports_reporter ON reports (reporter_id);

-- ============================================
-- 15. PAYMENTS TABLE
-- ============================================
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_id text UNIQUE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  currency text DEFAULT 'usd',
  type text NOT NULL CHECK (type IN ('promote', 'reserve_username', 'hidden_stack')),
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_payments_user ON payments (user_id);
CREATE INDEX idx_payments_stripe ON payments (stripe_payment_id);
CREATE INDEX idx_payments_status ON payments (status);

-- ============================================
-- 16. EXPLORE_RANKING MATERIALIZED VIEW
-- ============================================
CREATE MATERIALIZED VIEW explore_ranking AS
SELECT 
  s.id AS stack_id,
  (
    -- Upvotes weighted
    (COALESCE((s.stats->>'upvotes')::numeric, 0) * 2.0) +
    -- Saves count
    (COALESCE((s.stats->>'saves')::numeric, 0) * 1.5) +
    -- Quality score from owner
    (COALESCE(u.quality_score, 0) * 0.1) +
    -- Recency decay (newer stacks get boost)
    (CASE 
      WHEN s.created_at > now() - interval '7 days' THEN 10.0
      WHEN s.created_at > now() - interval '30 days' THEN 5.0
      WHEN s.created_at > now() - interval '90 days' THEN 2.0
      ELSE 1.0
    END) +
    -- Promotion boost
    (CASE WHEN s.promoted_until > now() THEN 50.0 ELSE 0.0 END)
  ) AS score,
  now() AS updated_at
FROM stacks s
LEFT JOIN users u ON s.owner_id = u.id
WHERE s.is_public = true AND s.is_hidden = false;

CREATE UNIQUE INDEX idx_explore_ranking_stack ON explore_ranking (stack_id);
CREATE INDEX idx_explore_ranking_score ON explore_ranking (score DESC);

-- Function to refresh explore_ranking
CREATE OR REPLACE FUNCTION refresh_explore_ranking()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY explore_ranking;
END;
$$ LANGUAGE plpgsql;

