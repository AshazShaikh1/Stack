-- Fix comments DELETE policy
-- The current policy might be too restrictive. This ensures soft delete works properly.

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Users and stack owners can delete comments" ON comments;

-- Recreate the UPDATE policy for soft delete (marking deleted = true)
-- This policy allows users to soft-delete their own comments or stack owners to delete comments on their stacks
CREATE POLICY "Users and stack owners can soft-delete comments"
ON comments FOR UPDATE
TO authenticated
USING (
  -- User is the comment author
  auth.uid() = user_id 
  -- OR user owns the stack this comment is on
  OR EXISTS (
    SELECT 1 FROM stacks s
    WHERE s.id = comments.target_id 
    AND comments.target_type = 'stack'
    AND s.owner_id = auth.uid()
  )
  -- OR user is admin
  OR is_admin(auth.uid())
)
WITH CHECK (
  -- When soft-deleting (setting deleted = true), allow it
  (deleted = true AND (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM stacks s
      WHERE s.id = comments.target_id 
      AND comments.target_type = 'stack'
      AND s.owner_id = auth.uid()
    )
    OR is_admin(auth.uid())
  ))
  -- OR when updating content (user is author)
  OR (auth.uid() = user_id AND deleted = false)
);

-- Verify the policy was created
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'comments' AND policyname = 'Users and stack owners can soft-delete comments';

