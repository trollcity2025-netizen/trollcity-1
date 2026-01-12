-- Ensure troll_wall_posts has is_pinned for pinned sorting
ALTER TABLE public.troll_wall_posts
  ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_troll_wall_posts_is_pinned
  ON public.troll_wall_posts(is_pinned)
  WHERE is_pinned = true;
