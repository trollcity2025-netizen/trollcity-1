BEGIN;

-- ==============================================================================
-- PHASE 2: ROLE-BASED ACCESS CONTROL (RBAC) & ZERO TRUST ENFORCEMENT
-- ==============================================================================

-- 1. Helper Functions (Centralized Logic)
--    These functions return boolean to simplify RLS policies.
--    They also enforce the "Not Banned" and "Not Suspended" checks globally.

-- Check if user is Staff (Citywide Powers)
CREATE OR REPLACE FUNCTION public.is_staff(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = p_user_id
      AND role IN ('admin', 'troll_officer', 'lead_troll_officer', 'secretary', 'pastor')
      AND (is_banned IS FALSE OR is_banned IS NULL)
      AND (suspended_until IS NULL OR suspended_until < NOW())
  );
END;
$$;

-- Check if user is the Owner of a Broadcast (and is active)
CREATE OR REPLACE FUNCTION public.is_broadcast_owner(p_stream_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check stream ownership AND user status
  RETURN EXISTS (
    SELECT 1 
    FROM streams s
    JOIN user_profiles up ON up.id = s.broadcaster_id
    WHERE s.id = p_stream_id 
      AND s.broadcaster_id = p_user_id
      AND (up.is_banned IS FALSE OR up.is_banned IS NULL)
      AND (up.suspended_until IS NULL OR up.suspended_until < NOW())
  );
END;
$$;

-- Check if user is an Assigned Officer for a Broadcast
-- (Must be assigned to the broadcaster who owns the stream)
CREATE OR REPLACE FUNCTION public.is_active_broadofficer(p_stream_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_broadcaster_id UUID;
BEGIN
  -- Get the broadcaster of the stream
  SELECT broadcaster_id INTO v_broadcaster_id
  FROM streams
  WHERE id = p_stream_id;

  IF v_broadcaster_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check assignment AND Officer Status
  RETURN EXISTS (
    SELECT 1 FROM broadcast_officers bo
    JOIN user_profiles up ON up.id = bo.officer_id
    WHERE bo.broadcaster_id = v_broadcaster_id
      AND bo.officer_id = p_user_id
      AND (up.is_banned IS FALSE OR up.is_banned IS NULL)
      AND (up.suspended_until IS NULL OR up.suspended_until < NOW())
  );
END;
$$;

-- ==============================================================================
-- 2. Public Directory (Safe View)
-- ==============================================================================

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  avatar_url,
  bio,
  role,
  created_at,
  is_verified,
  stream_count,
  followers_count,
  following_count,
  is_admin,
  is_lead_officer
FROM public.user_profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO authenticated;

-- ==============================================================================
-- 3. RLS Policies (Specific Tables)
-- ==============================================================================

-- A) User Profiles (Strict Lockdown)
--    - Update: Self only
--    - Select: Self, Staff, or via public_profiles view (for others)
--    - Note: The view handles public visibility. The table itself is strict.

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to be clean
DO $$ 
DECLARE pol record; 
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles' AND schemaname = 'public'
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', pol.policyname); 
    END LOOP; 
END $$;

CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Staff can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- B) Broadcasts (Streams)
--    - Select: Everyone (Public Read)
--    - Insert: Authenticated (Anyone can stream)
--    - Update: Owner or Staff

ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view streams"
  ON public.streams FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can create streams"
  ON public.streams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owner and Staff can update streams"
  ON public.streams FOR UPDATE
  USING (
    broadcaster_id = auth.uid() 
    OR public.is_staff(auth.uid())
  );

-- C) Messages (Chat)
--    - Select: Everyone
--    - Insert: Authenticated (User matches sender)
--    - Delete: Owner, Assigned Officer, or Staff

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view messages"
  ON public.messages FOR SELECT
  USING (true);

CREATE POLICY "Users can post messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Moderators can delete messages"
  ON public.messages FOR DELETE
  USING (
    public.is_staff(auth.uid())
    OR public.is_broadcast_owner(stream_id, auth.uid())
    OR public.is_active_broadofficer(stream_id, auth.uid())
  );

-- D) Broadcast Seats
--    - Select: Everyone
--    - Manage: Owner, Assigned Officer, Staff
--    - NOTE: Assuming 'room' column holds the stream_id as text (UUID string).

ALTER TABLE public.broadcast_seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view seats"
  ON public.broadcast_seats FOR SELECT
  USING (true);

CREATE POLICY "Moderators can manage seats"
  ON public.broadcast_seats FOR ALL
  USING (
    public.is_staff(auth.uid())
    OR public.is_broadcast_owner(room::uuid, auth.uid())
    OR public.is_active_broadofficer(room::uuid, auth.uid())
  );

-- E) Broadcast Seat Bans
--    - Select: Everyone (to know they are banned)
--    - Manage: Owner, Assigned Officer, Staff

ALTER TABLE public.broadcast_seat_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view bans"
  ON public.broadcast_seat_bans FOR SELECT
  USING (true);

CREATE POLICY "Moderators can manage bans"
  ON public.broadcast_seat_bans FOR ALL
  USING (
    public.is_staff(auth.uid())
    OR public.is_broadcast_owner(room::uuid, auth.uid())
    OR public.is_active_broadofficer(room::uuid, auth.uid())
  );

-- F) Citywide Moderation (Staff Only)
--    - Tables: moderation_actions, moderation_reports, user_bans
--    - Access: Staff only

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'moderation_actions', 
    'moderation_reports', 
    'moderation_notes', 
    'moderation_logs',
    'user_bans', 
    'shadow_bans', 
    'ip_bans',
    'kick_logs',
    'mute_logs'
  ]
  LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    
    -- Drop existing
    EXECUTE format('DROP POLICY IF EXISTS "Staff Access Only" ON public.%I', t);
    
    -- Create Staff Policy (Full Access for Staff)
    EXECUTE format('CREATE POLICY "Staff Access Only" ON public.%I FOR ALL USING (public.is_staff(auth.uid()))', t);
  END LOOP;
END $$;

COMMIT;
