-- Fix for "troll_wall_gifts_gift_type_check" violation
-- The previous migration 20270306000001_fix_gift_constraint.sql might have been skipped or conflicted.
-- We explicitly drop the constraint again to ensure dynamic gifts like 'troll-wink' can be inserted.

ALTER TABLE public.troll_wall_gifts
DROP CONSTRAINT IF EXISTS troll_wall_gifts_gift_type_check;
