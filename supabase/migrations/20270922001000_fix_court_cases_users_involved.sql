-- Compatibility fix: summon_user_to_court expects users_involved on court_cases.
-- Some environments may have an older court_cases schema without this column.

ALTER TABLE public.court_cases
ADD COLUMN IF NOT EXISTS users_involved TEXT;
