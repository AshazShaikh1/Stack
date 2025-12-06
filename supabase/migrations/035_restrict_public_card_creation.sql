-- Migration: Restrict public card creation to stacqers only
-- This adds a database-level RLS policy to prevent regular users from creating standalone public cards
-- This is a secondary defense in addition to the API-level validation

-- Drop existing policy if it exists (we'll recreate it with restrictions)
DROP POLICY IF EXISTS "Authenticated users can create cards" ON cards;

-- Create policy that allows card creation but restricts is_public
-- Regular users can create cards, but only stacqers can create standalone public cards
CREATE POLICY "Authenticated users can create cards"
ON cards FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- Allow if card is private (is_public = false)
    is_public = false
    -- OR user is a stacqer/admin (can create public cards)
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND (role = 'stacker' OR role = 'admin')
    )
  )
);

-- Add comment
COMMENT ON POLICY "Authenticated users can create cards" ON cards IS 
'Allows authenticated users to create cards. Regular users can only create private cards. Only stacqers and admins can create public standalone cards.';

-- Note: Cards added to collections will have their visibility controlled by the collection's visibility
-- This policy primarily prevents standalone public cards from being created by non-stacqers
