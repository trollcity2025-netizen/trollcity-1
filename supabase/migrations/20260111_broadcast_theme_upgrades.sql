-- Broadcast theme upgrades: assets, limited windows, exclusives, reactive events

-- Extend broadcast_background_themes with new fields
ALTER TABLE public.broadcast_background_themes
  ADD COLUMN IF NOT EXISTS asset_type text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS video_webm_url text,
  ADD COLUMN IF NOT EXISTS video_mp4_url text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS is_limited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_streamer_exclusive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_stream_level integer,
  ADD COLUMN IF NOT EXISTS min_followers integer,
  ADD COLUMN IF NOT EXISTS min_total_hours_streamed integer,
  ADD COLUMN IF NOT EXISTS reactive_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reactive_style text NOT NULL DEFAULT 'pulse',
  ADD COLUMN IF NOT EXISTS reactive_intensity integer NOT NULL DEFAULT 2;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'broadcast_background_themes'
      AND constraint_name = 'broadcast_background_themes_reactive_intensity_check'
  ) THEN
    ALTER TABLE public.broadcast_background_themes
      ADD CONSTRAINT broadcast_background_themes_reactive_intensity_check
      CHECK (reactive_intensity BETWEEN 1 AND 5);
  END IF;
END $$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_broadcast_theme_updated_at ON public.broadcast_background_themes;
CREATE TRIGGER set_broadcast_theme_updated_at
BEFORE UPDATE ON public.broadcast_background_themes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reactive event stream
CREATE TABLE IF NOT EXISTS public.broadcast_theme_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  broadcaster_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  theme_id uuid REFERENCES public.broadcast_background_themes(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_theme_events_room ON public.broadcast_theme_events(room_id, created_at DESC);

ALTER TABLE public.broadcast_theme_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broadcast_theme_events_read" ON public.broadcast_theme_events;
CREATE POLICY "broadcast_theme_events_read"
  ON public.broadcast_theme_events
  FOR SELECT
  USING (
    auth.uid() = broadcaster_id
    OR EXISTS (
      SELECT 1 FROM public.streams_participants
      WHERE stream_id = room_id AND user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS "broadcast_theme_events_insert" ON public.broadcast_theme_events;
CREATE POLICY "broadcast_theme_events_insert"
  ON public.broadcast_theme_events
  FOR INSERT
  WITH CHECK (
    auth.uid() = broadcaster_id
    OR EXISTS (
      SELECT 1 FROM public.streams_participants
      WHERE stream_id = room_id AND user_id = auth.uid() AND is_active = true
    )
  );

-- Streamer entitlements
CREATE TABLE IF NOT EXISTS public.user_streamer_entitlements (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  streamer_level integer NOT NULL DEFAULT 0,
  followers_count integer NOT NULL DEFAULT 0,
  total_hours_streamed integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streamer_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "streamer_entitlements_read_own" ON public.user_streamer_entitlements;
CREATE POLICY "streamer_entitlements_read_own"
  ON public.user_streamer_entitlements
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "streamer_entitlements_upsert_own" ON public.user_streamer_entitlements;
CREATE POLICY "streamer_entitlements_upsert_own"
  ON public.user_streamer_entitlements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "streamer_entitlements_update_own" ON public.user_streamer_entitlements;
CREATE POLICY "streamer_entitlements_update_own"
  ON public.user_streamer_entitlements
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "streamer_entitlements_admin_write" ON public.user_streamer_entitlements;
CREATE POLICY "streamer_entitlements_admin_write"
  ON public.user_streamer_entitlements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

-- Seed upgraded themes (open CC0 samples + placeholders)
INSERT INTO public.broadcast_background_themes (
  slug, name, preview_url, asset_type, video_webm_url, video_mp4_url, image_url, price_coins,
  is_active, rarity, sort_order, is_limited, starts_at, ends_at, is_streamer_exclusive,
  min_stream_level, min_followers, min_total_hours_streamed, reactive_enabled, reactive_style, reactive_intensity
)
VALUES
  ('neon-ripple-animated', 'Neon Ripple (Animated)', 'https://placehold.co/600x300/0a0a1f/3b82f6?text=Neon+Ripple',
   'video',
   'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
   'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
   null,
   2200, true, 'epic', 30, false, null, null, false, null, null, null, true, 'pulse', 3),
  ('pink-aurora-animated', 'Pink Aurora (Animated)', 'https://placehold.co/600x300/14041f/f472b6?text=Pink+Aurora',
   'video',
   'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
   'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
   null,
   2600, true, 'legendary', 40, false, null, null, false, null, null, null, true, 'wave', 4),
  ('winter-glow', 'Winter Glow (Seasonal)', 'https://placehold.co/600x300/0b1b2b/7dd3fc?text=Winter+Glow',
   'image',
   null,
   null,
   'https://placehold.co/1200x800/0b1b2b/7dd3fc?text=Winter+Glow',
   1400, true, 'rare', 50, true, now() - interval '1 day', now() + interval '30 days', false, null, null, null, true, 'spark', 2),
  ('spring-bloom', 'Spring Bloom (Seasonal)', 'https://placehold.co/600x300/0f1b12/86efac?text=Spring+Bloom',
   'image',
   null,
   null,
   'https://placehold.co/1200x800/0f1b12/86efac?text=Spring+Bloom',
   1200, true, 'rare', 60, true, now() - interval '1 day', now() + interval '21 days', false, null, null, null, false, 'pulse', 2),
  ('streamer-vip-grid', 'Streamer VIP Grid', 'https://placehold.co/600x300/0b1026/60a5fa?text=VIP+Grid',
   'image',
   null,
   null,
   'https://placehold.co/1200x800/0b1026/60a5fa?text=VIP+Grid',
   1800, true, 'epic', 70, false, null, null, true, 5, null, 10, true, 'wave', 3),
  ('streamer-legendary-core', 'Streamer Legendary Core', 'https://placehold.co/600x300/0f081b/f59e0b?text=Legendary+Core',
   'image',
   null,
   null,
   'https://placehold.co/1200x800/0f081b/f59e0b?text=Legendary+Core',
   0, true, 'legendary', 80, false, null, null, true, 10, 1000, 50, true, 'pulse', 5)
ON CONFLICT (slug) DO NOTHING;
