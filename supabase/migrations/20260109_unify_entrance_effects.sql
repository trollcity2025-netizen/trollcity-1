-- Migration: Unify Entrance Effects Logic
-- Purpose: Ensure set_active_entrance_effect updates all relevant tables (user_active_items, user_profiles, user_entrance_effects)
-- to maintain consistency across legacy and new systems.

CREATE OR REPLACE FUNCTION set_active_entrance_effect(
    p_effect_id TEXT,
    p_item_type TEXT DEFAULT 'effect'
)
RETURNS VOID AS $$
BEGIN
    -- 1. Deactivate in user_active_items (New Standard)
    DELETE FROM user_active_items
    WHERE user_id = auth.uid() 
    AND item_type IN ('effect', 'role_effect');

    -- 2. Deactivate in user_entrance_effects (Legacy / LivePage support)
    UPDATE user_entrance_effects
    SET is_active = false
    WHERE user_id = auth.uid();

    -- 3. Clear from user_profiles (Fast Lookup)
    UPDATE user_profiles
    SET active_entrance_effect = NULL
    WHERE id = auth.uid();

    -- IF ACTIVATING (p_effect_id is not null)
    IF p_effect_id IS NOT NULL THEN
        -- 1. Insert into user_active_items
        INSERT INTO user_active_items (user_id, item_id, item_type)
        VALUES (auth.uid(), p_effect_id, p_item_type)
        ON CONFLICT (user_id, item_id) DO NOTHING;

        -- 2. Update user_entrance_effects
        UPDATE user_entrance_effects
        SET is_active = true
        WHERE user_id = auth.uid() AND effect_id = p_effect_id;

        -- 3. Update user_profiles
        UPDATE user_profiles
        SET active_entrance_effect = p_effect_id
        WHERE id = auth.uid();
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
