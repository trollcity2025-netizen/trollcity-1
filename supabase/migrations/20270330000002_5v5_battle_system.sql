-- 5v5 Battle System + live_streams view
-- Adds missing columns, live_streams view, and find_5v5_match function

-- 1. Ensure live_streams view exists
CREATE OR REPLACE VIEW "public"."live_streams" AS
  SELECT *
  FROM "public"."streams"
  WHERE ("status" = 'live'::"text");

ALTER VIEW "public"."live_streams" OWNER TO "postgres";
GRANT ALL ON TABLE "public"."live_streams" TO "anon";
GRANT ALL ON TABLE "public"."live_streams" TO "authenticated";
GRANT ALL ON TABLE "public"."live_streams" TO "service_role";

-- 2. Add missing columns to battle_sessions (table already exists in baseline)
ALTER TABLE public.battle_sessions ADD COLUMN IF NOT EXISTS participants JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public.battle_sessions ADD COLUMN IF NOT EXISTS gift_count_a INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.battle_sessions ADD COLUMN IF NOT EXISTS gift_count_b INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.battle_sessions ADD COLUMN IF NOT EXISTS abilities_used JSONB NOT NULL DEFAULT '{}';

-- 3. find_5v5_match function (uses actual column names: stream_id, opponent_stream_id)
DROP FUNCTION IF EXISTS public.find_5v5_match(TEXT);
DROP FUNCTION IF EXISTS public.find_5v5_match(UUID);
CREATE OR REPLACE FUNCTION public.find_5v5_match(p_stream_id TEXT)
RETURNS TABLE (
  id TEXT,
  user_id UUID,
  title TEXT,
  category TEXT,
  current_viewers INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream RECORD;
BEGIN
  SELECT s.user_id, s.category INTO v_stream
  FROM public.streams s
  WHERE s.id::text = p_stream_id AND s.is_live = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stream not found or not live';
  END IF;

  IF v_stream.category != 'general' THEN
    RAISE EXCEPTION '5v5 battles are only available in General Chat category';
  END IF;

  RETURN QUERY
  SELECT s.id::text, s.user_id, s.title, s.category, s.current_viewers
  FROM public.streams s
  WHERE s.is_live = true
    AND s.category = 'general'
    AND s.id::text != p_stream_id
    AND s.user_id != v_stream.user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.battle_sessions bs
      WHERE (bs.stream_id::text = s.id::text OR bs.opponent_stream_id::text = s.id::text)
        AND bs.status IN ('pending', 'active')
    )
  ORDER BY RANDOM()
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_5v5_match TO authenticated;
