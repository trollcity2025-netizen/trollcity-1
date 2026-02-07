-- Cleanup future triggers that might be blocking current migrations due to circular dependencies
-- This file is inserted to drop the problematic triggers/functions before the migration that fails.

DROP TRIGGER IF EXISTS trg_protect_user_profiles ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_protect_streams ON public.streams;
DROP FUNCTION IF EXISTS public.protect_sensitive_columns();
