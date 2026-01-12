-- Add gift_slug column for storing gift slugs without UUID constraints
ALTER TABLE gifts
ADD COLUMN IF NOT EXISTS gift_slug text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'gifts'
      AND column_name = 'gift_id'
  ) THEN
    ALTER TABLE gifts
      ALTER COLUMN gift_id DROP NOT NULL;
  END IF;
END $$;
