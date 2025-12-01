-- Add DELETE policy for cards table
-- Allow card creators, stack owners, and admins to delete cards

CREATE POLICY "Card creators and stack owners can delete cards"
ON cards FOR DELETE
TO authenticated
USING (
  -- Card creator can delete
  created_by = auth.uid()
  -- OR user owns a stack containing this card
  OR EXISTS (
    SELECT 1 FROM stack_cards sc
    JOIN stacks s ON sc.stack_id = s.id
    WHERE sc.card_id = cards.id AND s.owner_id = auth.uid()
  )
  -- OR user is admin
  OR is_admin(auth.uid())
);

