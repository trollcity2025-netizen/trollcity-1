-- Function to set active entrance effect (enforcing single active effect)
CREATE OR REPLACE FUNCTION set_active_entrance_effect(
    p_effect_id TEXT DEFAULT NULL,
    p_item_type TEXT DEFAULT 'effect'
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Deactivate all entrance effects and role effects for the user
    -- We assume 'effect' and 'role_effect' are the types for entrance effects
    DELETE FROM user_active_items 
    WHERE user_id = v_user_id 
    AND item_type IN ('effect', 'role_effect');

    -- If a new effect is provided, activate it
    IF p_effect_id IS NOT NULL THEN
        INSERT INTO user_active_items (user_id, item_id, item_type)
        VALUES (v_user_id, p_effect_id, p_item_type);
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
