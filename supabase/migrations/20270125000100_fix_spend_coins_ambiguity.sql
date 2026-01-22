-- Migration: Cleanup duplicate spend_coins function
-- Description: Removes the integer version of spend_coins to resolve ambiguity with the bigint version.

-- Drop the integer version of spend_coins
DROP FUNCTION IF EXISTS public.spend_coins(uuid, uuid, integer, text, text);
