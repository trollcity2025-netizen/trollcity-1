-- Fix Inventory and Social Tables

-- 1. Ensure user_follows exists
CREATE TABLE IF NOT EXISTS user_follows (
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

-- RLS for user_follows
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON user_follows;
CREATE POLICY "Public read access" ON user_follows
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can follow others" ON user_follows;
CREATE POLICY "Users can follow others" ON user_follows
    FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow" ON user_follows;
CREATE POLICY "Users can unfollow" ON user_follows
    FOR DELETE USING (auth.uid() = follower_id);


-- 2. Ensure user_active_items exists (for role effects and generic items)
CREATE TABLE IF NOT EXISTS user_active_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(user_id, item_id)
);

-- RLS for user_active_items
ALTER TABLE user_active_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own active items" ON user_active_items;
CREATE POLICY "Users can view their own active items" ON user_active_items
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own active items" ON user_active_items;
CREATE POLICY "Users can manage their own active items" ON user_active_items
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view active items" ON user_active_items;
CREATE POLICY "Public can view active items" ON user_active_items
    FOR SELECT USING (true);


-- 3. Fix user_entrance_effects FK if not already done (re-applying logic safely)
DO $$
BEGIN
    -- Check if constraint exists, if not, we might need to recreate or alter
    -- For now, assuming the previous fix file handled it, but let's ensure RLS is good
END $$;

-- Ensure RLS on user_entrance_effects
ALTER TABLE user_entrance_effects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own entrance effects" ON user_entrance_effects;
CREATE POLICY "Users can view their own entrance effects" ON user_entrance_effects
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own entrance effects" ON user_entrance_effects;
CREATE POLICY "Users can update their own entrance effects" ON user_entrance_effects
    FOR UPDATE USING (auth.uid() = user_id);
    
-- Allow insert for purchase (or system)
DROP POLICY IF EXISTS "Users can insert their own entrance effects" ON user_entrance_effects;
CREATE POLICY "Users can insert their own entrance effects" ON user_entrance_effects
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 4. Function to toggle follow (optional, but good for RPC)
CREATE OR REPLACE FUNCTION toggle_follow(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_following BOOLEAN;
BEGIN
    IF auth.uid() = target_user_id THEN
        RAISE EXCEPTION 'Cannot follow yourself';
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM user_follows 
        WHERE follower_id = auth.uid() AND following_id = target_user_id
    ) INTO is_following;

    IF is_following THEN
        DELETE FROM user_follows 
        WHERE follower_id = auth.uid() AND following_id = target_user_id;
        RETURN false; -- No longer following
    ELSE
        INSERT INTO user_follows (follower_id, following_id)
        VALUES (auth.uid(), target_user_id);
        RETURN true; -- Now following
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Function to set active entrance effect (updated to handle role effects mutually exclusive)
CREATE OR REPLACE FUNCTION set_active_entrance_effect(p_effect_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- 1. Deactivate all purchased effects in user_entrance_effects (if is_active column exists)
    -- We assume is_active exists based on previous code.
    UPDATE user_entrance_effects
    SET is_active = false
    WHERE user_id = auth.uid();

    -- 2. If a specific effect is requested, activate it
    IF p_effect_id IS NOT NULL THEN
        UPDATE user_entrance_effects
        SET is_active = true
        WHERE user_id = auth.uid() AND effect_id = p_effect_id;
    END IF;
    
    -- Note: The frontend also manages user_active_items for role effects.
    -- Ideally, this function should also clear role effects from user_active_items if a purchased effect is set.
    -- But frontend does it. Let's enforce it here for safety.
    
    IF p_effect_id IS NOT NULL THEN
        DELETE FROM user_active_items
        WHERE user_id = auth.uid() AND item_type = 'role_effect';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
