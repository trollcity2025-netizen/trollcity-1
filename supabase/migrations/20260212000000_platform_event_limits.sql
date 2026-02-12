-- Drop existing tables to avoid lock conflicts and ensure clean state
DROP TABLE IF EXISTS public.platform_event CASCADE;
DROP TABLE IF EXISTS public.signup_queue CASCADE;

-- Create platform_event table
CREATE TABLE public.platform_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_hours INTEGER NOT NULL DEFAULT 48,
  is_active BOOLEAN DEFAULT true,
  signup_cap INTEGER DEFAULT 30,
  max_broadcasts INTEGER DEFAULT 2,
  max_guests_per_broadcast INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create signup_queue table
CREATE TABLE public.signup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notified BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.platform_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public can view active event" ON public.platform_event
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can join the queue" ON public.signup_queue
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage queue" ON public.signup_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to get active event
CREATE OR REPLACE FUNCTION public.get_active_event()
RETURNS SETOF public.platform_event AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.platform_event WHERE is_active = true LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get signup stats for active event
CREATE OR REPLACE FUNCTION public.get_active_event_signup_count()
RETURNS INTEGER AS $$
DECLARE
  v_start_time TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  SELECT start_time INTO v_start_time FROM public.platform_event WHERE is_active = true LIMIT 1;
  
  IF v_start_time IS NULL THEN
    RETURN 0;
  END IF;

  SELECT count(*)::INTEGER INTO v_count 
  FROM public.user_profiles 
  WHERE created_at >= v_start_time;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert the 48-hour event
INSERT INTO public.platform_event (event_name, duration_hours, signup_cap, max_broadcasts, max_guests_per_broadcast)
VALUES ('The 48-Hour Launch Event', 48, 30, 2, 2)
ON CONFLICT DO NOTHING;
