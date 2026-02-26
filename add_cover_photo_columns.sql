-- Add cover photo columns to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS cover_photo_url TEXT,
ADD COLUMN IF NOT EXISTS cover_position_x FLOAT DEFAULT 50,
ADD COLUMN IF NOT EXISTS cover_position_y FLOAT DEFAULT 50,
ADD COLUMN IF NOT EXISTS cover_zoom FLOAT DEFAULT 1;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_cover_photo ON user_profiles(cover_photo_url) WHERE cover_photo_url IS NOT NULL;

-- Add RLS policies for cover photo
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to update their own cover photo
CREATE POLICY "Users can update own cover photo" ON user_profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow read access to cover photos
CREATE POLICY "Anyone can read cover photos" ON user_profiles
  FOR SELECT USING (true);
