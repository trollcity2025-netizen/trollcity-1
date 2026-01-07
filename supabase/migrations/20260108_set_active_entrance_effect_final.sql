CREATE OR REPLACE FUNCTION set_active_entrance_effect(p_effect_id TEXT, p_item_type TEXT DEFAULT 'effect')
RETURNS VOID AS $$
BEGIN
  -- 1. Deactivate all entrance effects (both purchased and role-based)
  DELETE FROM user_active_items
  WHERE user_id = auth.uid() 
  AND item_type IN ('effect', 'role_effect');

  -- Also update legacy user_entrance_effects if it has is_active column (safeguard)
  -- We assume it might exist, but to avoid errors if it doesn't, we can skip or use dynamic SQL.
  -- However, in Supabase SQL editor we can't easily do dynamic SQL for column existence check without permissions sometimes.
  -- Given the previous migration `20250107_fix_inventory_social.sql` tried to update it, it likely exists or the user wants it to.
  -- But `UserInventory.tsx` seems to prioritize `user_active_items`.
  -- Let's stick to `user_active_items` which is the new standard as per the code.

  -- 2. Activate the new effect if provided
  IF p_effect_id IS NOT NULL THEN
    INSERT INTO user_active_items (user_id, item_id, item_type)
    VALUES (auth.uid(), p_effect_id, p_item_type)
    ON CONFLICT (user_id, item_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
