
-- Create streams table if it doesn't exist (safety net for start over)
CREATE TABLE IF NOT EXISTS public.streams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT,
  status TEXT DEFAULT 'pending', -- pending, live, ended
  box_count INTEGER DEFAULT 1,
  seat_price INTEGER DEFAULT 0,
  are_seats_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Ensure RLS on streams
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read streams" ON public.streams FOR SELECT USING (true);
CREATE POLICY "Broadcasters manage streams" ON public.streams FOR ALL USING (auth.uid() = user_id);

-- Moderators (Broadofficers) - Permanent assignment
CREATE TABLE IF NOT EXISTS public.stream_moderators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcaster_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- The broadcaster who appointed them
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- The moderator
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(broadcaster_id, user_id)
);

-- Bans (Per stream)
CREATE TABLE IF NOT EXISTS public.stream_bans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stream_id, user_id)
);

-- Mutes (Per stream)
CREATE TABLE IF NOT EXISTS public.stream_mutes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stream_id, user_id)
);

-- RLS for Moderators
ALTER TABLE public.stream_moderators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read moderators" ON public.stream_moderators FOR SELECT USING (true);
CREATE POLICY "Broadcasters manage moderators" ON public.stream_moderators FOR ALL USING (auth.uid() = broadcaster_id);

-- Helper function to check permission
CREATE OR REPLACE FUNCTION public.is_moderator(p_stream_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_broadcaster_id UUID;
BEGIN
  SELECT user_id INTO v_broadcaster_id FROM public.streams WHERE id = p_stream_id;
  
  -- Broadcaster is always a moderator
  IF v_broadcaster_id = p_user_id THEN
    RETURN true;
  END IF;

  -- Check if user is a designated moderator for this broadcaster
  IF EXISTS (SELECT 1 FROM public.stream_moderators WHERE broadcaster_id = v_broadcaster_id AND user_id = p_user_id) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for Bans
ALTER TABLE public.stream_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read bans" ON public.stream_bans FOR SELECT USING (true);
CREATE POLICY "Hosts and Mods manage bans" ON public.stream_bans FOR ALL USING (
  public.is_moderator(stream_id, auth.uid())
);

-- RLS for Mutes
ALTER TABLE public.stream_mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read mutes" ON public.stream_mutes FOR SELECT USING (true);
CREATE POLICY "Hosts and Mods manage mutes" ON public.stream_mutes FOR ALL USING (
  public.is_moderator(stream_id, auth.uid())
);

-- RPC: Kick User (Ban)
CREATE OR REPLACE FUNCTION public.kick_user(p_stream_id UUID, p_user_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  -- Check permission
  IF NOT public.is_moderator(p_stream_id, auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.stream_bans (stream_id, user_id, reason)
  VALUES (p_stream_id, p_user_id, p_reason)
  ON CONFLICT (stream_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Mute User
CREATE OR REPLACE FUNCTION public.mute_user(p_stream_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_moderator(p_stream_id, auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.stream_mutes (stream_id, user_id)
  VALUES (p_stream_id, p_user_id)
  ON CONFLICT (stream_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Unmute User
CREATE OR REPLACE FUNCTION public.unmute_user(p_stream_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_moderator(p_stream_id, auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.stream_mutes WHERE stream_id = p_stream_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Assign Broadofficer
CREATE OR REPLACE FUNCTION public.assign_broadofficer(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.stream_moderators (broadcaster_id, user_id)
  VALUES (auth.uid(), p_user_id)
  ON CONFLICT (broadcaster_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Remove Broadofficer
CREATE OR REPLACE FUNCTION public.remove_broadofficer(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.stream_moderators 
  WHERE broadcaster_id = auth.uid() AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
