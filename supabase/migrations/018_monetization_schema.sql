-- ============================================
-- MONETIZATION SCHEMA UPDATES
-- ============================================

-- Add featured_until to users table for Featured Stacqers
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS featured_until timestamptz;

-- Add index for featured users
CREATE INDEX IF NOT EXISTS idx_users_featured ON users (featured_until DESC) WHERE featured_until IS NOT NULL;

-- Add reserved_username flag to users table
-- This indicates if the username was reserved via payment
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS reserved_username boolean DEFAULT false;

-- Add index for reserved usernames
CREATE INDEX IF NOT EXISTS idx_users_reserved_username ON users (reserved_username) WHERE reserved_username = true;

-- Add metadata column to payments for storing additional payment data
-- (e.g., stack_id for promotions, username for reservations)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Add index for payments metadata queries
CREATE INDEX IF NOT EXISTS idx_payments_metadata ON payments USING GIN (metadata);

-- Update explore_ranking to boost featured stacqers
-- This will be done by updating the refresh function
CREATE OR REPLACE FUNCTION refresh_explore_ranking()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY explore_ranking;
END;
$$ LANGUAGE plpgsql;

-- Recreate explore_ranking with featured stacqer boost
DROP MATERIALIZED VIEW IF EXISTS explore_ranking;

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
    -- Featured stacqer boost
    (CASE WHEN u.featured_until > now() THEN 25.0 ELSE 0.0 END) +
    -- Recency decay (newer collections get boost)
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

