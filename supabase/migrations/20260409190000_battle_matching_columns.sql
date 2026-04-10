-- Add automatic battle matching columns
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS looking_for_battle BOOLEAN DEFAULT false;
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS looking_for_battle_since TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_streams_looking_for_battle ON public.streams(looking_for_battle, looking_for_battle_since)
WHERE looking_for_battle = true;

-- Cleanup old looking for battle entries every hour
CREATE OR REPLACE FUNCTION public.cleanup_stale_battle_searches()
RETURNS void AS $$
BEGIN
  UPDATE public.streams
  SET looking_for_battle = false, looking_for_battle_since = null
  WHERE looking_for_battle = true 
  AND looking_for_battle_since < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;