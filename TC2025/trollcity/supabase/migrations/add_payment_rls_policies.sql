-- Enable RLS on profiles table and add policies for payment methods
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to update their own payment information
CREATE POLICY "Users can update own payment info" ON profiles
FOR UPDATE USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile" ON profiles
FOR SELECT USING (auth.uid() = id);

-- Grant permissions to authenticated users
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;