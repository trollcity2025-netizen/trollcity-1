-- Add foreign key constraint for artist_profiles.label_id -> record_labels(id)
-- This enables Supabase relationship queries between artist_profiles and record_labels

-- First, check if the column exists and add it if needed
ALTER TABLE artist_profiles 
ADD COLUMN IF NOT EXISTS label_id UUID REFERENCES record_labels(id) ON DELETE SET NULL;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_artist_profiles_label_id ON artist_profiles(label_id);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON artist_profiles TO authenticated;
GRANT SELECT ON record_labels TO authenticated;

-- If there are existing NULL values, you may need to handle them
-- This is optional depending on your data
-- UPDATE artist_profiles SET label_id = NULL WHERE label_id IS NOT NULL 
--   AND label_id NOT IN (SELECT id FROM record_labels);
