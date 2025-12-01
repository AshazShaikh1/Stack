-- ============================================
-- RLS POLICIES FOR MONETIZATION
-- ============================================

-- Users can view their own featured status
-- Featured status is public (anyone can see if a user is featured)
-- No special RLS needed for viewing featured_until

-- Payments RLS is already set up in 002_rls_policies.sql
-- Users can view their own payments
-- Admins can view all payments
-- Only service role can insert payments (via webhooks)

-- No additional RLS needed for reserved_username flag
-- It's just a boolean flag on the users table

