-- Quick verification query to check if scheduled_announcements table exists
-- Run this in Supabase SQL Editor to verify the table structure

-- Check if table exists
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'scheduled_announcements'
ORDER BY ordinal_position;

-- If the above returns no rows, the table doesn't exist. Run the migration:
-- Copy and paste the "SCHEDULED ANNOUNCEMENTS TABLE" section from run_missing_migrations.sql

-- If the table exists but scheduled_time column is missing, run this:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scheduled_announcements' AND column_name = 'scheduled_time'
  ) THEN
    ALTER TABLE scheduled_announcements 
      ADD COLUMN scheduled_time timestamptz;
    UPDATE scheduled_announcements 
      SET scheduled_time = created_at 
      WHERE scheduled_time IS NULL;
    ALTER TABLE scheduled_announcements 
      ALTER COLUMN scheduled_time SET NOT NULL;
    RAISE NOTICE 'Added scheduled_time column successfully';
  ELSE
    RAISE NOTICE 'scheduled_time column already exists';
  END IF;
END $$;

