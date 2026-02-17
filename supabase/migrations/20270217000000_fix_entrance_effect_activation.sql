-- Fix for entrance effect activation error
-- The issue: set_active_entrance_effect tries to insert into user_active_items
-- with text effect_id (e.g., "effect_troll_city_world_domination") but 
-- user_active_items.item_id is UUID type, causing: 
-- "invalid input syntax for type uuid: effect_troll_city_world_domination"
--
-- Solution: For entrance effects, we should NOT insert into user_active_items
-- since they have their own table (user_entrance_effects) that uses TEXT effect_id.
-- Instead, we only update user_entrance_effects.is_active and user_profiles.active_entrance_effect

-- Drop existing function
DROP FUNCTION IF EXISTS set_active_entrance_effect(text, text);

-- Create fixed version that handles entrance effects properly
CREATE OR REPLACE FUNCTION "public"."set_active_entrance_effect"(
  "p_effect_id" "text", 
  "p_item_type" "text" DEFAULT 'effect'::"text"
) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  -- 1. Deactivate ALL entrance effects in user_entrance_effects table
  UPDATE user_entrance_effects
  SET is_active = false
  WHERE user_id = auth.uid();

  -- 2. Clear any entrance effects from user_active_items (they shouldn't be there anyway)
  DELETE FROM user_active_items
  WHERE user_id = auth.uid() 
  AND item_type IN ('effect', 'role_effect');

  -- 3. Clear user_profiles active field
  UPDATE user_profiles
  SET active_entrance_effect = NULL
  WHERE id = auth.uid();

  -- 4. Activate the new effect if provided
  IF p_effect_id IS NOT NULL THEN
    -- Update user_entrance_effects to mark the effect as active
    -- This is the correct table for entrance effects (uses TEXT effect_id)
    UPDATE user_entrance_effects
    SET is_active = true
    WHERE user_id = auth.uid() AND effect_id = p_effect_id;

    -- Always update user_profiles with the provided effect identifier (text)
    -- This is what the frontend uses to determine which effect to display
    UPDATE user_profiles
    SET active_entrance_effect = p_effect_id
    WHERE id = auth.uid();
  END IF;
END;
$$;

-- Grant permissions
GRANT ALL ON FUNCTION "public"."set_active_entrance_effect"("p_effect_id" "text", "p_item_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_active_entrance_effect"("p_effect_id" "text", "p_item_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_active_entrance_effect"("p_effect_id" "text", "p_item_type" "text") TO "service_role";

-- Also update the single-parameter version for backwards compatibility
DROP FUNCTION IF EXISTS set_active_entrance_effect(text);

CREATE OR REPLACE FUNCTION "public"."set_active_entrance_effect"("p_effect_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  -- Simply call the two-parameter version with default item_type
  PERFORM set_active_entrance_effect(p_effect_id, 'effect');
END;
$$;

GRANT ALL ON FUNCTION "public"."set_active_entrance_effect"("p_effect_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_active_entrance_effect"("p_effect_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_active_entrance_effect"("p_effect_id" "text") TO "service_role";

-- Verify the fix is applied
DO $$
BEGIN
  RAISE NOTICE 'Entrance effect activation fix applied successfully';
END $$;
