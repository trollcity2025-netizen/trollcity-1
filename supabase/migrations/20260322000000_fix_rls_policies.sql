-- Fix RLS policies for troll_station_hosts and officer_members tables
-- Enable RLS and add SELECT policies if not exist

-- Check if officer_members table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'officer_members'
);

-- If officer_members exists but has no read policy, add one
DO $$
BEGIN
  -- Add policy for officer_members if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'officer_members'
  ) THEN
    -- Enable RLS if not enabled
    ALTER TABLE IF EXISTS public.officer_members ENABLE ROW LEVEL SECURITY;
    
    -- Create read policy if not exists
    DROP POLICY IF EXISTS "Anyone can view officer members" ON public.officer_members;
    CREATE POLICY "Anyone can view officer members" ON public.officer_members FOR SELECT USING (true);
  END IF;
  
  -- Add policy for troll_station_hosts if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'troll_station_hosts'
  ) THEN
    ALTER TABLE IF EXISTS public.troll_station_hosts ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Anyone can view hosts" ON public.troll_station_hosts;
    CREATE POLICY "Anyone can view hosts" ON public.troll_station_hosts FOR SELECT USING (true);
  END IF;
  
  -- Add policy for troll_station_sessions
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'troll_station_sessions'
  ) THEN
    ALTER TABLE IF EXISTS public.troll_station_sessions ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Anyone can view station sessions" ON public.troll_station_sessions;
    CREATE POLICY "Anyone can view station sessions" ON public.troll_station_sessions FOR SELECT USING (true);
  END IF;
  
  -- Add policy for troll_families and troll_family_members
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'troll_families'
  ) THEN
    ALTER TABLE IF EXISTS public.troll_families ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Anyone can view families" ON public.troll_families;
    CREATE POLICY "Anyone can view families" ON public.troll_families FOR SELECT USING (true);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'troll_family_members'
  ) THEN
    ALTER TABLE IF EXISTS public.troll_family_members ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Anyone can view family members" ON public.troll_family_members;
    CREATE POLICY "Anyone can view family members" ON public.troll_family_members FOR SELECT USING (true);
  END IF;
END $$;