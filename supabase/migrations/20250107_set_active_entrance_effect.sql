CREATE OR REPLACE FUNCTION set_active_entrance_effect(p_effect_id TEXT)
RETURNS VOID AS $$
BEGIN
  -- First, deactivate ALL entrance effects for this user
  UPDATE user_profiles
  SET active_entrance_effect = NULL
  WHERE id = auth.uid();

  -- If p_effect_id is provided (not null), set it as active
  -- We store the active effect ID directly in user_profiles for easy access
  -- Alternatively, if using user_active_items, we would manage it there.
  -- Based on the UserInventory.tsx code, it seems we might be using user_active_items OR a field on profile.
  -- Let's support both for robustness or check what UserInventory expects.
  -- UserInventory.tsx calls: supabase.rpc('set_active_entrance_effect', { p_effect_id: newEffectId })
  
  IF p_effect_id IS NOT NULL THEN
    UPDATE user_profiles
    SET active_entrance_effect = p_effect_id
    WHERE id = auth.uid();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
