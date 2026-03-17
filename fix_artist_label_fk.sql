-- Migration: Add foreign key for artist_profiles -> record_labels
-- Run this in Supabase Dashboard SQL Editor to fix the relationship error

-- Step 1: Add label_id column if it doesn't exist
ALTER TABLE artist_profiles 
ADD COLUMN IF NOT EXISTS label_id UUID REFERENCES record_labels(id) ON DELETE SET NULL;

-- Step 2: Add index for the column
CREATE INDEX IF NOT EXISTS idx_artist_profiles_label_id ON artist_profiles(label_id);

-- Step 3: Refresh the PostgREST schema cache
-- This tells Supabase to reload its schema cache to recognize the new relationship
NOTIFY pgrst, 'reload schema';

-- Verify the foreign key was created
SELECT 
    tc.constraint_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'artist_profiles' 
AND tc.constraint_type = 'FOREIGN KEY'
AND kcu.column_name = 'label_id';
