-- Backfill script for card_attributions
-- This script creates attributions from existing data
-- Run in dry-run mode first, then execute

-- Drop old function if it exists (to avoid conflicts)
DROP FUNCTION IF EXISTS backfill_card_attributions(boolean);

-- Function to backfill attributions (idempotent)
-- Returns count of inserted rows
CREATE OR REPLACE FUNCTION backfill_card_attributions(dry_run boolean DEFAULT true)
RETURNS integer AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  IF dry_run THEN
    -- Return count of what would be inserted (don't actually insert)
    SELECT COUNT(*) INTO inserted_count
    FROM (
      SELECT c.id, c.created_by
      FROM cards c
      WHERE c.created_by IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM card_attributions ca
        WHERE ca.card_id = c.id 
        AND ca.user_id = c.created_by 
        AND ca.source = 'import'
        AND ca.stack_id IS NULL
      )
      
      UNION ALL
      
      SELECT sc.card_id, sc.added_by
      FROM stack_cards sc
      WHERE sc.added_by IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM card_attributions ca
        WHERE ca.card_id = sc.card_id 
        AND ca.user_id = sc.added_by 
        AND ca.source = 'stack'
        AND ca.stack_id = sc.stack_id
      )
    ) AS to_insert;
    
    RETURN inserted_count;
  ELSE
    -- Backfill from cards.created_by
    -- Use explicit table qualification in ON CONFLICT to avoid ambiguity
    WITH inserted_from_cards AS (
      INSERT INTO card_attributions (card_id, user_id, source, stack_id)
      SELECT 
        c.id,
        c.created_by,
        'import',
        NULL
      FROM cards c
      WHERE c.created_by IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM card_attributions ca
        WHERE ca.card_id = c.id 
        AND ca.user_id = c.created_by 
        AND ca.source = 'import'
        AND ca.stack_id IS NULL
      )
      ON CONFLICT ON CONSTRAINT card_attributions_card_id_user_id_source_stack_id_key DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*) INTO inserted_count FROM inserted_from_cards;
    
    -- Backfill from stack_cards.added_by
    WITH inserted_from_stacks AS (
      INSERT INTO card_attributions (card_id, user_id, source, stack_id)
      SELECT 
        sc.card_id,
        sc.added_by,
        'stack',
        sc.stack_id
      FROM stack_cards sc
      WHERE sc.added_by IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM card_attributions ca
        WHERE ca.card_id = sc.card_id 
        AND ca.user_id = sc.added_by 
        AND ca.source = 'stack'
        AND ca.stack_id = sc.stack_id
      )
      ON CONFLICT ON CONSTRAINT card_attributions_card_id_user_id_source_stack_id_key DO NOTHING
      RETURNING 1
    )
    SELECT inserted_count + COUNT(*) INTO inserted_count FROM inserted_from_stacks;
    
    RETURN inserted_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Dry-run function (returns what would be inserted with details)
CREATE OR REPLACE FUNCTION backfill_card_attributions_dry_run()
RETURNS TABLE(
  card_id uuid,
  user_id uuid,
  source text,
  stack_id uuid,
  card_title text
) AS $$
BEGIN
  RETURN QUERY
  -- From cards.created_by
  SELECT 
    c.id,
    c.created_by,
    'import'::text,
    NULL::uuid,
    c.title
  FROM cards c
  WHERE c.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM card_attributions ca
    WHERE ca.card_id = c.id 
    AND ca.user_id = c.created_by 
    AND ca.source = 'import'
    AND ca.stack_id IS NULL
  )
  
  UNION ALL
  
  -- From stack_cards.added_by
  SELECT 
    sc.card_id,
    sc.added_by,
    'stack'::text,
    sc.stack_id,
    c.title
  FROM stack_cards sc
  JOIN cards c ON c.id = sc.card_id
  WHERE sc.added_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM card_attributions ca
    WHERE ca.card_id = sc.card_id 
    AND ca.user_id = sc.added_by 
    AND ca.source = 'stack'
    AND ca.stack_id = sc.stack_id
  );
END;
$$ LANGUAGE plpgsql;

-- Usage examples:
-- Dry run (see what would be inserted):
-- SELECT * FROM backfill_card_attributions_dry_run();

-- Check count (dry run):
-- SELECT backfill_card_attributions(dry_run := true);

-- Execute backfill:
-- SELECT backfill_card_attributions(dry_run := false);
