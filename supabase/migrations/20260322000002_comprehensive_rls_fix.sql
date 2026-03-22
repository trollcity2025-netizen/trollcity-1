-- Comprehensive RLS fix - Force overwrite all related policies
-- This script will recreate all necessary RLS policies

-- First, let's check and fix each table

-- 1. Check if officer_members exists
SELECT 'Checking officer_members...' as check_name;
SELECT count(*) FROM information_schema.tables WHERE table_name = 'officer_members';

-- Fix officer_members
ALTER TABLE IF EXISTS public.officer_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all read access" ON public.officer_members;
DROP POLICY IF EXISTS "Anyone can read" ON public.officer_members;
CREATE POLICY "Allow all read access" ON public.officer_members FOR SELECT USING (true);

-- Check current policies on officer_members
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'officer_members';

-- 2. Check if troll_station_hosts exists
SELECT 'Checking troll_station_hosts...' as check_name;
SELECT count(*) FROM information_schema.tables WHERE table_name = 'troll_station_hosts';

-- Fix troll_station_hosts 
ALTER TABLE IF EXISTS public.troll_station_hosts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all read access" ON public.troll_station_hosts;
DROP POLICY IF EXISTS "Anyone can view hosts" ON public.troll_station_hosts;
DROP POLICY IF EXISTS "Anyone can read hosts" ON public.troll_station_hosts;
CREATE POLICY "Allow all read access" ON public.troll_station_hosts FOR SELECT USING (true);

-- Check current policies on troll_station_hosts
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'troll_station_hosts';

-- 3. Fix troll_station_sessions
ALTER TABLE IF EXISTS public.troll_station_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all read access" ON public.troll_station_sessions;
DROP POLICY IF EXISTS "Anyone can view sessions" ON public.troll_station_sessions;
CREATE POLICY "Allow all read access" ON public.troll_station_sessions FOR SELECT USING (true);

-- 4. Fix troll_families
ALTER TABLE IF EXISTS public.troll_families ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all read access" ON public.troll_families;
DROP POLICY IF EXISTS "Anyone can view families" ON public.troll_families;
CREATE POLICY "Allow all read access" ON public.troll_families FOR SELECT USING (true);

-- Fix family_members
ALTER TABLE IF EXISTS public.family_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all read access" ON public.family_members;
CREATE POLICY "Allow all read access" ON public.family_members FOR SELECT USING (true);

-- Fix troll_family_members
ALTER TABLE IF EXISTS public.troll_family_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all read access" ON public.troll_family_members;
CREATE POLICY "Allow all read access" ON public.troll_family_members FOR SELECT USING (true);

-- Run this to verify policies are in place
SELECT 
    schemaname,
    tablename, 
    policyname, 
    permissive, 
    cmd, 
    qual::text
FROM pg_policies 
WHERE tablename IN ('officer_members', 'troll_station_hosts', 'troll_station_sessions', 'troll_families', 'family_members', 'troll_family_members')
ORDER BY tablename;