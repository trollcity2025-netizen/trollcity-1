-- Fix for infinite recursion in troll_family_members RLS policy
-- This policy allows users to see all members of their families

-- Drop the broken recursive policy
DROP POLICY IF EXISTS "troll_family_members_select" ON public.troll_family_members;

-- Create a new non-recursive policy using SECURITY DEFINER function
-- First create a helper function that checks membership without recursion
CREATE OR REPLACE FUNCTION public.user_is_family_member(p_family_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.family_members fm
        WHERE fm.family_id = p_family_id
        AND fm.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a simple policy without self-reference
CREATE POLICY "troll_family_members_select" ON public.troll_family_members
FOR SELECT TO authenticated
USING (
    -- User can see their own record
    user_id = auth.uid()
    OR
    -- User can see other members in their families (using the helper function)
    public.user_is_family_member(family_id)
);

-- Also fix the insert policy to be simpler
DROP POLICY IF EXISTS "auth_insert_own" ON public.troll_family_members;

CREATE POLICY "auth_insert_own" ON public.troll_family_members
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Fix the update policy
DROP POLICY IF EXISTS "auth_update_own" ON public.troll_family_members;

CREATE POLICY "auth_update_own" ON public.troll_family_members
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Fix the delete policy
DROP POLICY IF EXISTS "auth_delete_own" ON public.troll_family_members;

CREATE POLICY "auth_delete_own" ON public.troll_family_members
FOR DELETE TO authenticated
USING (user_id = auth.uid());

SELECT 'Fixed troll_family_members RLS policies successfully!' as result;
