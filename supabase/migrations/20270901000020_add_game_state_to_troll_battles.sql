-- Add game_state JSONB column to troll_battles
ALTER TABLE public.troll_battles
ADD COLUMN IF NOT EXISTS game_state JSONB DEFAULT '{}'::jsonb;

-- Add game_type column to troll_battles
ALTER TABLE public.troll_battles
ADD COLUMN IF NOT EXISTS game_type TEXT;

-- Create an index on game_type for faster lookups
CREATE INDEX IF NOT EXISTS idx_troll_battles_game_type ON public.troll_battles (game_type);
