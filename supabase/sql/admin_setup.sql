-- Ensure the profile table tracks admin flags and create supporting role metadata
BEGIN;

-- Keep an explicit admin flag on user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Tracks user roles, so we can mark admins via user_roles instead of hard-coding emails
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view roles for access checks"
  ON user_roles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  ));

-- Lightweight helper for RLS policies
CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role = 'admin'
  );
$$ LANGUAGE SQL STABLE;

-- Guard user_profiles with RLS policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their profile"
  ON user_profiles FOR SELECT, UPDATE
  USING (auth.uid() = id OR public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can manage any profile"
  ON user_profiles FOR SELECT, UPDATE
  USING (public.is_admin_user(auth.uid()));

COMMIT;
