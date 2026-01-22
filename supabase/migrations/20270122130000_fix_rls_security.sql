-- Enable RLS for broadcast_theme_events
ALTER TABLE IF EXISTS public.broadcast_theme_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read access" ON public.broadcast_theme_events FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own events" ON public.broadcast_theme_events FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable RLS for court_ai_messages
ALTER TABLE IF EXISTS public.court_ai_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own AI messages" ON public.court_ai_messages FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own AI messages" ON public.court_ai_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable RLS for rooms
ALTER TABLE IF EXISTS public.rooms ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read access for rooms" ON public.rooms FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable RLS for vehicle_auction_bids (ensure it is enabled)
ALTER TABLE IF EXISTS public.vehicle_auction_bids ENABLE ROW LEVEL SECURITY;

-- Conditional RLS for vehicle_bids (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'vehicle_bids') THEN
        ALTER TABLE "public"."vehicle_bids" ENABLE ROW LEVEL SECURITY;
        
        -- Attempt to create policy if not exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' AND tablename = 'vehicle_bids' AND policyname = 'Public read access for vehicle_bids'
        ) THEN
            CREATE POLICY "Public read access for vehicle_bids" ON "public"."vehicle_bids" FOR SELECT USING (true);
        END IF;
    END IF;
END $$;

-- Conditional RLS for recent_matches (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'recent_matches') THEN
        ALTER TABLE "public"."recent_matches" ENABLE ROW LEVEL SECURITY;
        
        -- Attempt to create policy if not exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' AND tablename = 'recent_matches' AND policyname = 'Public read access for recent_matches'
        ) THEN
            CREATE POLICY "Public read access for recent_matches" ON "public"."recent_matches" FOR SELECT USING (true);
        END IF;
    END IF;
END $$;
