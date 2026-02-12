-- Drop old unguarded end_battle function to prevent premature battle endings
-- The new end_battle_guarded function enforces minimum duration

DROP FUNCTION IF EXISTS public.end_battle(UUID, UUID);
DROP FUNCTION IF EXISTS public.end_battle(UUID);
