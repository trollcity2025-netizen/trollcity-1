-- Fix RLS for Broadcast Chat
ALTER TABLE public.stream_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Stream Messages" ON public.stream_messages
FOR SELECT
USING (true);

CREATE POLICY "Authenticated Insert Stream Messages" ON public.stream_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Broadcaster/Mod Delete Stream Messages" ON public.stream_messages
FOR DELETE
USING (
  auth.uid() IN (
    SELECT user_id FROM streams WHERE id = stream_messages.stream_id
    UNION
    SELECT user_id FROM stream_moderators WHERE broadcaster_id = (SELECT user_id FROM streams WHERE id = stream_messages.stream_id)
  )
);

-- Fix Likes Counter Trigger
CREATE OR REPLACE FUNCTION public.update_stream_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.streams
    SET total_likes = total_likes + 1
    WHERE id = NEW.stream_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.streams
    SET total_likes = total_likes - 1
    WHERE id = OLD.stream_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_stream_like ON public.stream_likes;
CREATE TRIGGER on_stream_like
AFTER INSERT OR DELETE ON public.stream_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_stream_likes_count();

-- Fix Stream Seats RLS (Guests/Viewers need to see seats)
ALTER TABLE public.stream_seat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Stream Seats" ON public.stream_seat_sessions
FOR SELECT
USING (true);

-- Fix Entrance Effects RLS
ALTER TABLE public.user_entrance_effects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Entrance Effects" ON public.user_entrance_effects
FOR SELECT
USING (true);

-- Fix Purchasable Items RLS
ALTER TABLE public.purchasable_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Purchasable Items" ON public.purchasable_items
FOR SELECT
USING (true);

