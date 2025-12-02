-- Comprehensive fixes for Troll City application
-- This migration ensures all required tables exist and are properly configured

-- 1. Ensure applications table has all required columns
DO $$ 
BEGIN
  -- Add type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'applications' AND column_name = 'type'
  ) THEN
    ALTER TABLE applications ADD COLUMN type TEXT;
  END IF;

  -- Add data JSONB column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'applications' AND column_name = 'data'
  ) THEN
    ALTER TABLE applications ADD COLUMN data JSONB;
  END IF;
END $$;

-- 1.5. Ensure streams table has testing mode and thumbnail columns
DO $$ 
BEGIN
  -- Add is_testing_mode column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'streams' AND column_name = 'is_testing_mode'
  ) THEN
    ALTER TABLE streams ADD COLUMN is_testing_mode BOOLEAN DEFAULT FALSE;
  END IF;

  -- Ensure thumbnail_url exists (should already exist but check anyway)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'streams' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE streams ADD COLUMN thumbnail_url TEXT;
  END IF;
END $$;

-- 2. Ensure user_profiles has all required columns for applications
DO $$ 
BEGIN
  -- Add is_lead_officer if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'is_lead_officer'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_lead_officer BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add officer_role if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'officer_role'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN officer_role TEXT;
  END IF;

  -- Ensure empire_role exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'empire_role'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN empire_role TEXT;
  END IF;

  -- Ensure is_broadcaster exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'is_broadcaster'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_broadcaster BOOLEAN DEFAULT FALSE;
  END IF;

  -- Ensure username is not null and has a default
  ALTER TABLE user_profiles ALTER COLUMN username SET DEFAULT 'user' || substr(gen_random_uuid()::text, 1, 8);
  
  -- Ensure username is unique (if not already)
  CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_unique ON user_profiles(username) WHERE username IS NOT NULL;
END $$;

-- 3. Ensure streams table allows all users to view (for orientation)
-- Update RLS policy to allow all authenticated users to view live streams
DROP POLICY IF EXISTS "Anyone can view live streams" ON streams;
CREATE POLICY "Anyone can view live streams" ON streams 
  FOR SELECT 
  USING (is_live = true OR auth.role() = 'authenticated');

-- 4. Ensure messages table has all required columns
DO $$ 
BEGIN
  -- Add seen column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'seen'
  ) THEN
    ALTER TABLE messages ADD COLUMN seen BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add read_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN read_at TIMESTAMPTZ;
  END IF;

  -- Ensure message_type exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'dm';
  END IF;
END $$;

-- 5. Create RPC function to approve lead officer application
CREATE OR REPLACE FUNCTION approve_lead_officer_application(
  p_application_id UUID,
  p_reviewer_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_app_type TEXT;
BEGIN
  -- Get application details
  SELECT user_id, type INTO v_user_id, v_app_type
  FROM applications
  WHERE id = p_application_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found or already processed');
  END IF;

  IF v_app_type != 'lead_officer' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a lead officer application');
  END IF;

  -- Update user profile
  UPDATE user_profiles
  SET 
    is_lead_officer = TRUE,
    officer_role = 'lead_officer',
    role = CASE WHEN role = 'user' THEN 'lead_officer' ELSE role END,
    updated_at = NOW()
  WHERE id = v_user_id;

  -- Update application status
  UPDATE applications
  SET 
    status = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW()
  WHERE id = p_application_id;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Ensure applications are visible to both admin and lead officers
-- Update RLS policies for applications table
DROP POLICY IF EXISTS "Admins can view all applications" ON applications;
CREATE POLICY "Admins can view all applications" ON applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR is_lead_officer = TRUE OR officer_role IN ('lead_officer', 'owner'))
    )
  );

-- 7. Create function to check if lead officer position is filled
CREATE OR REPLACE FUNCTION is_lead_officer_position_filled()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE is_lead_officer = TRUE 
    OR officer_role = 'lead_officer'
    OR officer_role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Ensure storage bucket exists for avatars
-- Note: This should be run in Supabase dashboard, but we'll document it here
-- CREATE BUCKET IF NOT EXISTS troll-city-assets WITH public = true;

-- 9. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- 10. Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_username_lower ON user_profiles(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_applications_type_status ON applications(type, status);
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_seen ON messages(seen) WHERE seen = FALSE;

COMMENT ON TABLE applications IS 'All user applications including lead officer, troll officer, troller, and family';
COMMENT ON COLUMN user_profiles.is_lead_officer IS 'True if user is a lead officer';
COMMENT ON COLUMN user_profiles.officer_role IS 'Officer role: lead_officer, owner, or null';
COMMENT ON COLUMN user_profiles.empire_role IS 'Empire partner role: partner or null';

