-- Fix default troll_coins for new users from 500 to 10
-- Run this in Supabase SQL Editor

-- Update the trigger function to set 10 coins instead of 500
CREATE OR REPLACE FUNCTION "public"."set_default_troll_coins"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  IF NEW.troll_coins IS NULL OR NEW.troll_coins < 10 THEN
    NEW.troll_coins := 10;
  END IF;
  RETURN NEW;
END;
$$;

-- Verify the change
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'set_default_troll_coins';