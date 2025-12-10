-- Add recruiter_id column to profiles table for manual Empire Partner assignments
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS recruiter_id uuid REFERENCES profiles(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_recruiter_id ON profiles(recruiter_id);

-- Add RLS policy for recruiter_id (users can view their own recruiter relationship)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can view own recruiter relationship'
  ) THEN
    CREATE POLICY "Users can view own recruiter relationship"
      ON profiles
      FOR SELECT
      USING (auth.uid() = id OR auth.uid() = recruiter_id);
  END IF;
END $$;