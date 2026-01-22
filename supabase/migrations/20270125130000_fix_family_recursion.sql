-- Fix infinite recursion in family_members RLS policies

-- 1. Create helper functions to bypass RLS for membership checks
-- These functions run as the table owner (SECURITY DEFINER), avoiding the RLS loop
CREATE OR REPLACE FUNCTION public.is_family_member_secure(p_family_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.family_members 
    WHERE family_id = p_family_id 
    AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_family_leader_secure(p_family_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.family_members 
    WHERE family_id = p_family_id 
    AND user_id = p_user_id
    AND role = 'leader'
  );
$$;

-- 2. Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view members of their families" ON "public"."family_members";
DROP POLICY IF EXISTS "Leaders can manage family members" ON "public"."family_members";

-- 3. Re-create policies using secure functions

-- Allow users to view members of families they belong to
CREATE POLICY "Users can view members of their families" ON "public"."family_members" 
FOR SELECT USING (
    user_id = auth.uid() -- Always can see own
    OR
    public.is_family_member_secure(family_id, auth.uid())
);

-- Allow leaders to manage their family members
CREATE POLICY "Leaders can manage family members" ON "public"."family_members" 
FOR ALL USING (
    public.is_family_leader_secure(family_id, auth.uid())
);
