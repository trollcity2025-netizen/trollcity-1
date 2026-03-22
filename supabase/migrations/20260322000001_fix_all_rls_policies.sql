-- Fix RLS policies for troll_station_hosts table
-- This table needs a SELECT policy to allow reading host data

-- Check if table exists and enable RLS if needed
DO $$
BEGIN
  -- Enable RLS if not enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'troll_station_hosts' AND schemaname = 'public'
  ) THEN
    RAISE NOTICE 'troll_station_hosts table does not exist';
    RETURN;
  END IF;

  -- Enable RLS
  ALTER TABLE public.troll_station_hosts ENABLE ROW LEVEL SECURITY;

  -- Drop existing policies
  DROP POLICY IF EXISTS "Anyone can view hosts" ON public.troll_station_hosts;
  DROP POLICY IF EXISTS "Allow all read access" ON public.troll_station_hosts;

  -- Create proper SELECT policy - allows anyone to view hosts
  CREATE POLICY "Allow all read access" ON public.troll_station_hosts 
    FOR SELECT USING (true);

  RAISE NOTICE 'RLS policies created for troll_station_hosts';
END $$;

-- Also fix officer_members table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'officer_members' AND schemaname = 'public'
  ) THEN
    RAISE NOTICE 'officer_members table does not exist';
    RETURN;
  END IF;

  -- Enable RLS
  ALTER TABLE public.officer_members ENABLE ROW LEVEL SECURITY;

  -- Drop existing policies and create new one
  DROP POLICY IF EXISTS "Anyone can view officer members" ON public.officer_members;
  DROP POLICY IF EXISTS "Allow all read access" ON public.officer_members;

  CREATE POLICY "Allow all read access" ON public.officer_members 
    FOR SELECT USING (true);

  RAISE NOTICE 'RLS policies created for officer_members';
END $$;

-- Fix troll_station_sessions table  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'troll_station_sessions' AND schemaname = 'public'
  ) THEN
    RAISE NOTICE 'troll_station_sessions table does not exist';
    RETURN;
  END IF;

  ALTER TABLE public.troll_station_sessions ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Anyone can view station sessions" ON public.troll_station_sessions;
  DROP POLICY IF EXISTS "Allow all read access" ON public.troll_station_sessions;

  CREATE POLICY "Allow all read access" ON public.troll_station_sessions 
    FOR SELECT USING (true);

  RAISE NOTICE 'RLS policies created for troll_station_sessions';
END $$;

-- Fix troll_families table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'troll_families' AND schemaname = 'public'
  ) THEN
    RAISE NOTICE 'troll_families table does not exist';
    RETURN;
  END IF;

  ALTER TABLE public.troll_families ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Anyone can view families" ON public.troll_families;
  DROP POLICY IF EXISTS "Allow all read access" ON public.troll_families;

  CREATE POLICY "Allow all read access" ON public.troll_families 
    FOR SELECT USING (true);

  RAISE NOTICE 'RLS policies created for troll_families';
END $$;

-- Fix family_members table (join table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'family_members' AND schemaname = 'public'
  ) THEN
    RAISE NOTICE 'family_members table does not exist';
    RETURN;
  END IF;

  ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Anyone can view family members" ON public.family_members;
  DROP POLICY IF EXISTS "Allow all read access" ON public.family_members;

  CREATE POLICY "Allow all read access" ON public.family_members 
    FOR SELECT USING (true);

  RAISE NOTICE 'RLS policies created for family_members';
END $$;